import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "HR_MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    activeConversations,
    totalMessages,
    botMessages,
    aiConversations,
  ] = await Promise.all([
    db.conversation.count({ where: { status: "ACTIVE", botEnabled: true } }),
    db.message.count({ where: { senderType: { in: ["CANDIDATE", "BOT"] } } }),
    db.message.count({ where: { senderType: "BOT" } }),
    db.aIConversation.count({ where: { status: "ACTIVE" } }),
  ]);

  // avg response time: time between consecutive CANDIDATE → BOT pairs (last 100)
  const recentBotMessages = await db.message.findMany({
    where: { senderType: "BOT" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { conversationId: true, createdAt: true },
  });

  let avgResponseMs = 0;
  if (recentBotMessages.length > 0) {
    const deltas: number[] = [];
    for (const botMsg of recentBotMessages) {
      const prevCandidate = await db.message.findFirst({
        where: {
          conversationId: botMsg.conversationId,
          senderType: "CANDIDATE",
          createdAt: { lt: botMsg.createdAt },
        },
        orderBy: { createdAt: "desc" },
      });
      if (prevCandidate) {
        deltas.push(botMsg.createdAt.getTime() - prevCandidate.createdAt.getTime());
      }
    }
    if (deltas.length > 0) {
      avgResponseMs = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    }
  }

  const candidateMsgCount = totalMessages - botMessages;
  const responseRate = candidateMsgCount > 0
    ? Math.min(100, Math.round((botMessages / candidateMsgCount) * 100))
    : 0;

  return NextResponse.json({
    activeConversations,
    aiConversations,
    responseRate,
    avgResponseSeconds: Math.round(avgResponseMs / 1000),
    totalBotMessages: botMessages,
  });
}
