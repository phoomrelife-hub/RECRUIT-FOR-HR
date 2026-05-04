import { db } from "@/lib/db";
import { sendToDaniel } from "@/lib/openclaw-client";
import { getDanielReplyWithContext } from "@/lib/daniel-bot";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const { candidateId, message, channel = "LINE" } = body;

  if (!candidateId || !message) {
    return NextResponse.json({ error: "candidateId and message required" }, { status: 400 });
  }

  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    include: { interestedPosition: true },
  });
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  // find or create conversation
  let conversation = await db.conversation.findFirst({
    where: { candidateId, status: { not: "CLOSED" } },
  });
  if (!conversation) {
    conversation = await db.conversation.create({
      data: { candidateId, channel },
    });
  }

  // save candidate message
  await db.message.create({
    data: { conversationId: conversation.id, content: message, senderType: "CANDIDATE" },
  });

  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), status: "ACTIVE", unreadCount: { increment: 1 } },
  });

  // auto-promote NEW_APPLICANT → BOT_SCREENING
  if (candidate.currentStatus === "NEW_APPLICANT") {
    await db.candidate.update({ where: { id: candidateId }, data: { currentStatus: "BOT_SCREENING" } });
    await db.candidateStatusHistory.create({
      data: { candidateId, fromStatus: "NEW_APPLICANT", toStatus: "BOT_SCREENING", reason: "Bot conversation started" },
    });
  }

  let botReplyContent: string | null = null;
  let openclawId: string | undefined;
  let handoff = false;

  if (conversation.botEnabled) {
    // === PRIMARY: OpenClaw AI (main AI engine) ===
    const recentMsgs = await db.message.findMany({
      where: { conversationId: conversation.id, senderType: { in: ["CANDIDATE", "BOT"] } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    const history = recentMsgs.map((m) => ({
      role: m.senderType === "CANDIDATE" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    const danielReply = await getDanielReplyWithContext({
      conversationId: conversation.id,
      candidateId,
      message,
      channel,
      context: {
        candidateName: candidate.nickname ?? candidate.fullName,
        position: candidate.interestedPosition?.title ?? null,
        status: candidate.currentStatus,
      },
      recentMessages: history,
    });

    if (danielReply?.reply) {
      botReplyContent = danielReply.reply;
      openclawId = danielReply.openclawId;
      handoff = danielReply.handoff ?? false;

      // sync AIConversation record with openclawId
      if (openclawId) {
        await db.aIConversation.upsert({
          where: { conversationId: conversation.id },
          update: { openclawId },
          create: {
            conversationId: conversation.id,
            openclawId,
            status: "ACTIVE",
          },
        });
      }

      // if OpenClaw signals handoff → disable bot and log takeover system message
      if (handoff) {
        await db.conversation.update({
          where: { id: conversation.id },
          data: { botEnabled: false },
        });
        await db.message.create({
          data: {
            conversationId: conversation.id,
            content: "Daniel ส่งต่อให้ HR รับช่วง",
            senderType: "SYSTEM",
          },
        });
      }
    }

    if (botReplyContent) {
      await db.message.create({
        data: { conversationId: conversation.id, content: botReplyContent, senderType: "BOT" },
      });
      await db.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
      });
    }
  }

  return NextResponse.json({
    success: true,
    conversationId: conversation.id,
    botEnabled: conversation.botEnabled,
    reply: botReplyContent,
    source: openclawId ? "openclaw" : "fallback",
  });
}
