import { db } from "@/lib/db";
import { getDanielReply } from "@/lib/daniel-bot";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  // TEMP: log raw payload to inspect OpenClaw format
  console.log("[openclaw webhook] raw body:", JSON.stringify(body, null, 2));
  console.log("[openclaw webhook] headers:", Object.fromEntries(req.headers.entries()));
  const { candidateId, message, channel = "LINE" } = body;

  if (!candidateId || !message) {
    return NextResponse.json({ error: "candidateId and message required" }, { status: 400 });
  }

  const candidate = await db.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

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
    data: {
      conversationId: conversation.id,
      content: message,
      senderType: "CANDIDATE",
    },
  });

  // count existing messages to determine bot script position
  const msgCount = await db.message.count({
    where: { conversationId: conversation.id },
  });

  await db.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      status: "ACTIVE",
      unreadCount: { increment: 1 },
    },
  });

  // update candidate to BOT_SCREENING if still NEW_APPLICANT
  if (candidate.currentStatus === "NEW_APPLICANT") {
    await db.candidate.update({
      where: { id: candidateId },
      data: { currentStatus: "BOT_SCREENING" },
    });
    await db.candidateStatusHistory.create({
      data: {
        candidateId,
        fromStatus: "NEW_APPLICANT",
        toStatus: "BOT_SCREENING",
        reason: "Bot conversation started",
      },
    });
  }

  // bot responds if enabled
  let botMessage = null;
  if (conversation.botEnabled) {
    const candidateMsgCount = await db.message.count({
      where: { conversationId: conversation.id, senderType: "CANDIDATE" },
    });

    // load recent conversation history for context (last 20 messages)
    const recentMsgs = await db.message.findMany({
      where: { conversationId: conversation.id, senderType: { in: ["CANDIDATE", "BOT"] } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const history = recentMsgs.map((m) => ({
      role: m.senderType === "CANDIDATE" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    const botReplyContent = await getDanielReply(candidateMsgCount, history);

    if (botReplyContent) {
      botMessage = await db.message.create({
        data: {
          conversationId: conversation.id,
          content: botReplyContent,
          senderType: "BOT",
        },
      });

      await db.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
      });
    }
  }

  return NextResponse.json({
    conversationId: conversation.id,
    botEnabled: conversation.botEnabled,
    botReplied: !!botMessage,
  });
}
