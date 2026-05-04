import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "HR_MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conversations = await db.conversation.findMany({
    where: { status: "ACTIVE" },
    orderBy: { lastMessageAt: "desc" },
    take: 20,
    include: {
      candidate: { select: { id: true, nickname: true, fullName: true, currentStatus: true, sourceChannel: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      aiConversation: { select: { openclawId: true, status: true } },
    },
  });

  return NextResponse.json(
    conversations.map((c) => ({
      id: c.id,
      candidate: c.candidate,
      channel: c.channel,
      botEnabled: c.botEnabled,
      unreadCount: c.unreadCount,
      lastMessageAt: c.lastMessageAt,
      lastMessage: c.messages[0]?.content ?? null,
      lastMessageSender: c.messages[0]?.senderType ?? null,
      openclawId: c.aiConversation?.openclawId ?? null,
    }))
  );
}
