import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyFbSignature, getVerifyToken, getFbProfile, sendFbMessage, FbWebhookPayload } from "@/lib/facebook";

// VPS bridge — forwards the FB message to middleware.py /fb/webhook, where it is
// wrapped as a synthetic LINE event and answered by the same OpenClaw (หลิน) brain.
// The bot reply is delivered straight to Messenger by outbound_dedup.py (Graph API).
const FB_BRIDGE_URL =
  process.env.FB_BRIDGE_URL ?? "https://doorway-armless-roamer.ngrok-free.dev/fb/webhook";
const FB_BRIDGE_SECRET = process.env.FB_BRIDGE_SECRET ?? "";

async function forwardToBotBridge(psid: string, text: string, mid: string) {
  try {
    await fetch(FB_BRIDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(FB_BRIDGE_SECRET ? { "X-FB-Bridge-Secret": FB_BRIDGE_SECRET } : {}),
      },
      body: JSON.stringify({ psid, text, mid }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.error("[FB webhook] bridge forward failed:", err);
  }
}

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
      // Skip echoes — messages the Page itself sent (e.g. the bot's own reply).
      // Without this, the bot's reply re-enters as a new inbound message → loop.
      if (event.message?.is_echo) continue;

      // Only handle text messages (skip delivery/read receipts, etc.)
      if (!event.message?.text || event.message.text === "") continue;

      const facebookUserId = event.sender.id;
      const messageText    = event.message.text;
      const messageId      = event.message.mid;
      // Quick-reply taps carry the real intent in payload; text is the chip title.
      const quickReplyPayload = event.message.quick_reply?.payload;

      // Extra guard: never process a message whose sender is the recipient (self)
      if (event.recipient?.id === facebookUserId) continue;

      try {
        await handleFbMessage(facebookUserId, messageText, messageId, quickReplyPayload);
      } catch (err) {
        console.error("[FB webhook] error processing message:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// ─── Core message handler ─────────────────────────────────────────────────────

async function handleFbMessage(facebookUserId: string, text: string, externalId: string, quickReplyPayload?: string) {
  // fetch Messenger profile (name + picture) — null on failure
  const fbProfile = await getFbProfile(facebookUserId);

  // find or create candidate
  let candidate = await db.candidate.findUnique({
    where: { facebookUserId },
    include: { interestedPosition: { select: { title: true } } },
  });
  if (!candidate) {
    candidate = await db.candidate.create({
      data: {
        // lineProfilePicUrl is reused as the generic avatar source in the UI
        nickname: fbProfile?.name || "Facebook User",
        lineProfilePicUrl: fbProfile?.profilePicUrl ?? null,
        facebookUserId,
        sourceChannel: "FACEBOOK",
        currentStatus: "NEW_APPLICANT",
      },
      include: { interestedPosition: { select: { title: true } } },
    });
  } else if (fbProfile && (fbProfile.name || fbProfile.profilePicUrl)) {
    // refresh name/picture if we got a profile and the candidate still has the placeholder
    const data: { nickname?: string; lineProfilePicUrl?: string } = {};
    if (fbProfile.name && (!candidate.nickname || candidate.nickname === "Facebook User")) {
      data.nickname = fbProfile.name;
    }
    if (fbProfile.profilePicUrl && !candidate.lineProfilePicUrl) {
      data.lineProfilePicUrl = fbProfile.profilePicUrl;
    }
    if (Object.keys(data).length) {
      candidate = await db.candidate.update({
        where: { id: candidate.id },
        data,
        include: { interestedPosition: { select: { title: true } } },
      });
    }
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

  // Interview confirmation quick reply (สะดวก / ไม่สะดวก) — handle here, skip the bot.
  // Use the quick-reply payload when present (the visible chip title has an emoji).
  const intent = (quickReplyPayload ?? text).trim();
  if ((intent === "สะดวก" || intent === "ไม่สะดวก") && candidate.currentStatus === "INTERVIEW_SCHEDULED") {
    await handleFbInterviewResponse(candidate, intent as "สะดวก" | "ไม่สะดวก");
    return;
  }

  // Hand off to the VPS bot bridge (same OpenClaw brain as LINE). The bridge
  // debounces, runs the agent, and delivers the reply via Graph API + syncs it
  // back here through /api/openclaw/sync. Skip if HR has disabled the bot.
  if (conversation.botEnabled) {
    await forwardToBotBridge(facebookUserId, text, externalId);
  }
}

// ─── Interview confirmation (สะดวก / ไม่สะดวก) for Facebook ─────────────────────
// Mirrors the LINE handler in /api/openclaw/sync. Records the candidate's
// response and, on ไม่สะดวก, replies that the team will follow up.
async function handleFbInterviewResponse(
  candidate: { id: string; facebookUserId: string | null; fullName: string | null; nickname: string | null },
  response: "สะดวก" | "ไม่สะดวก",
) {
  try {
    const interview = await db.interview.findFirst({
      where: { candidateId: candidate.id, status: "SCHEDULED" },
      orderBy: { createdAt: "desc" },
    });
    if (!interview || interview.candidateResponse) return; // already answered

    await db.interview.update({
      where: { id: interview.id },
      data: {
        candidateResponse: response === "สะดวก" ? "confirmed" : "declined",
        respondedAt: new Date(),
      },
    });

    if (response === "ไม่สะดวก" && candidate.facebookUserId) {
      const name = candidate.fullName ?? candidate.nickname ?? "คุณ";
      await sendFbMessage(
        candidate.facebookUserId,
        `ขอบคุณที่แจ้งให้ทราบนะคะ คุณ${name} 🙏\nทางทีมจะติดต่อกลับเพื่อนัดวันที่สะดวกให้ค่ะ 😊`,
        "CONFIRMED_EVENT_UPDATE",
      ).catch(() => null);
    }
  } catch (err) {
    console.error("[FB webhook] interview response error:", err);
  }
}
