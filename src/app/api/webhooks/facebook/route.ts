import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyFbSignature, getVerifyToken, sendFbMessage, FbWebhookPayload } from "@/lib/facebook";
import { sendToDaniel } from "@/lib/openclaw-client";
import { sanitizeBotReply } from "@/lib/sanitize-bot-reply";

// ─── GET — Webhook verification challenge ────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new Response("Bad Request", { status: 400 });
  }

  const verifyToken = await getVerifyToken();
  if (!verifyToken || token !== verifyToken) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(challenge, { status: 200 });
}

// ─── POST — Receive messages ─────────────────────────────────────────────────

export async function POST(req: Request) {
  const rawBody  = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  // Verify signature
  const valid = await verifyFbSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: FbWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.object !== "page") {
    return NextResponse.json({ ok: true }); // ignore non-page events
  }

  for (const entry of payload.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      // Only handle text messages (skip echoes, delivery receipts, etc.)
      if (!event.message?.text || event.message.text === "") continue;

      const facebookUserId = event.sender.id;
      const messageText    = event.message.text;
      const messageId      = event.message.mid;

      // Skip messages sent by the page itself (echo)
      if (event.recipient?.id === facebookUserId) continue;

      try {
        await handleFbMessage(facebookUserId, messageText, messageId);
      } catch (err) {
        console.error("[FB webhook] error processing message:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// ─── Core message handler ─────────────────────────────────────────────────────

async function handleFbMessage(facebookUserId: string, text: string, externalId: string) {
  // find or create candidate
  let candidate = await db.candidate.findUnique({
    where: { facebookUserId },
    include: { interestedPosition: { select: { title: true } } },
  });
  if (!candidate) {
    candidate = await db.candidate.create({
      data: {
        nickname: "Facebook User",
        facebookUserId,
        sourceChannel: "FACEBOOK",
        currentStatus: "NEW_APPLICANT",
      },
      include: { interestedPosition: { select: { title: true } } },
    });
  }

  // find or create active conversation
  let conversation = await db.conversation.findFirst({
    where: { candidateId: candidate.id, status: { not: "CLOSED" } },
  });
  if (!conversation) {
    conversation = await db.conversation.create({
      data: { candidateId: candidate.id, channel: "FACEBOOK", botEnabled: true },
    });
  }

  // dedup: skip if we've already saved this message
  const existing = await db.message.findFirst({ where: { externalId } });
  if (existing) return;

  // save candidate message
  await db.message.create({
    data: {
      conversationId: conversation.id,
      content: text,
      senderType: "CANDIDATE",
      externalId,
    },
  });

  // auto-promote NEW_APPLICANT → BOT_SCREENING
  if (candidate.currentStatus === "NEW_APPLICANT") {
    await db.candidate.update({
      where: { id: candidate.id },
      data: { currentStatus: "BOT_SCREENING" },
    });
    await db.candidateStatusHistory.create({
      data: {
        candidateId: candidate.id,
        fromStatus: "NEW_APPLICANT",
        toStatus: "BOT_SCREENING",
        reason: "Facebook Messenger conversation started",
      },
    });
  }

  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), status: "ACTIVE", unreadCount: { increment: 1 } },
  });

  // Bot reply via OpenClaw only (if botEnabled)
  if (conversation.botEnabled) {
    try {
      const ocReply = await sendToDaniel({
        conversationId: conversation.id,
        candidateId: candidate.id,
        message: text,
        channel: "FACEBOOK",
        context: {
          candidateName: candidate.nickname ?? candidate.fullName,
          position: candidate.interestedPosition?.title ?? null,
          status: candidate.currentStatus,
        },
      });

      if (ocReply?.reply) {
        const botReply = sanitizeBotReply(ocReply.reply);

        await sendFbMessage(facebookUserId, botReply);
        await db.message.create({
          data: { conversationId: conversation.id, content: botReply, senderType: "BOT" },
        });
        await db.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        });

        if (ocReply.handoff) {
          await db.conversation.update({
            where: { id: conversation.id },
            data: { botEnabled: false },
          });
        }
      }
    } catch (err) {
      console.error("[FB webhook] bot reply failed:", err);
    }
  }
}
