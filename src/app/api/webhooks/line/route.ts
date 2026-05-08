import { db } from "@/lib/db";
import { verifyLineSignature, getLineProfile, type LineWebhookPayload } from "@/lib/line";
import { NextResponse } from "next/server";

// Direct LINE webhook receiver (fallback path)
// Production flow: LINE → Cloudflare tunnel → middleware.py → OpenClaw → openclaw/sync
// This route handles LINE messages if the webhook is pointed directly at Vercel.
// Bot replies are handled by OpenClaw (via middleware.py), NOT from here.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  const valid = await verifyLineSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload: LineWebhookPayload = JSON.parse(rawBody);

  for (const event of payload.events) {
    if (event.type !== "message" || event.message.type !== "text") continue;

    const lineUserId = event.source.userId;
    const messageText = event.message.text;
    const externalId = event.message.id;

    const lineProfile = await getLineProfile(lineUserId);

    // find or create candidate
    let candidate = await db.candidate.findUnique({ where: { lineUserId } });
    if (!candidate) {
      candidate = await db.candidate.create({
        data: {
          nickname: lineProfile?.displayName ?? "LINE User",
          lineUserId,
          lineDisplayName: lineProfile?.displayName ?? null,
          lineProfilePicUrl: lineProfile?.pictureUrl ?? null,
          sourceChannel: "LINE",
          currentStatus: "NEW_APPLICANT",
        },
      });
    } else if (lineProfile) {
      candidate = await db.candidate.update({
        where: { id: candidate.id },
        data: {
          lineDisplayName: lineProfile.displayName,
          lineProfilePicUrl: lineProfile.pictureUrl ?? null,
        },
      });
    }

    // find or create active conversation
    let conversation = await db.conversation.findFirst({
      where: { candidateId: candidate.id, status: { not: "CLOSED" } },
    });
    if (!conversation) {
      conversation = await db.conversation.create({
        data: { candidateId: candidate.id, channel: "LINE" },
      });
    }

    // save candidate message
    await db.message.create({
      data: { conversationId: conversation.id, content: messageText, senderType: "CANDIDATE", externalId },
    });

    // auto-promote NEW_APPLICANT → BOT_SCREENING
    if (candidate.currentStatus === "NEW_APPLICANT") {
      await db.candidate.update({ where: { id: candidate.id }, data: { currentStatus: "BOT_SCREENING" } });
      await db.candidateStatusHistory.create({
        data: {
          candidateId: candidate.id,
          fromStatus: "NEW_APPLICANT",
          toStatus: "BOT_SCREENING",
          reason: "LINE conversation started",
        },
      });
    }

    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: "ACTIVE", unreadCount: { increment: 1 } },
    });

    // Note: bot reply is handled by OpenClaw via middleware.py, not here
  }

  return NextResponse.json({ ok: true });
}
