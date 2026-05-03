import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// OpenClaw calls this endpoint after Daniel-hr sends/receives a LINE message
// Payload from OpenClaw:
// {
//   lineUserId: string
//   displayName?: string
//   userMessage: string       — candidate's message
//   botReply?: string         — Daniel-hr's reply (null if HR takeover)
//   externalMessageId?: string
// }

export async function POST(req: Request) {
  // Verify shared secret
  const secret = req.headers.get("x-openclaw-secret");
  if (
    process.env.OPENCLAW_SYNC_SECRET &&
    secret !== process.env.OPENCLAW_SYNC_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { lineUserId, displayName, userMessage, botReply, externalMessageId } = body;

  if (!lineUserId || !userMessage) {
    return NextResponse.json({ error: "lineUserId and userMessage required" }, { status: 400 });
  }

  // find or create candidate by lineUserId
  let candidate = await db.candidate.findUnique({ where: { lineUserId } });
  if (!candidate) {
    candidate = await db.candidate.create({
      data: {
        nickname: displayName ?? "LINE User",
        lineUserId,
        sourceChannel: "LINE",
        currentStatus: "NEW_APPLICANT",
      },
    });
  } else if (displayName && candidate.nickname === "LINE User") {
    await db.candidate.update({
      where: { id: candidate.id },
      data: { nickname: displayName },
    });
  }

  // find or create active conversation
  let conversation = await db.conversation.findFirst({
    where: { candidateId: candidate.id, status: { not: "CLOSED" } },
  });
  if (!conversation) {
    conversation = await db.conversation.create({
      data: { candidateId: candidate.id, channel: "LINE", botEnabled: false },
    });
  }

  // save candidate message
  const existing = externalMessageId
    ? await db.message.findFirst({ where: { externalId: externalMessageId } })
    : null;

  if (!existing) {
    await db.message.create({
      data: {
        conversationId: conversation.id,
        content: userMessage,
        senderType: "CANDIDATE",
        externalId: externalMessageId ?? null,
      },
    });
  }

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
        reason: "OpenClaw LINE conversation started",
      },
    });
  }

  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), status: "ACTIVE", unreadCount: { increment: 1 } },
  });

  // save bot reply if present
  if (botReply) {
    await db.message.create({
      data: {
        conversationId: conversation.id,
        content: botReply,
        senderType: "BOT",
      },
    });

    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, conversationId: conversation.id });
}
