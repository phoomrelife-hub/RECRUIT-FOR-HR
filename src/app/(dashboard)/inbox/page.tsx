import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InboxClient } from "./inbox-client";

export default async function InboxPage() {
  const session = await auth();

  const [conversations, quickReplies, candidates] = await Promise.all([
    db.conversation.findMany({
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            nickname: true,
            phone: true,
            sourceChannel: true,
            currentStatus: true,
            interestedPosition: { select: { id: true, title: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, content: true, senderType: true, createdAt: true },
        },
      },
      orderBy: [{ unreadCount: "desc" }, { lastMessageAt: "desc" }],
    }),
    db.quickReply.findMany({ orderBy: { sortOrder: "asc" } }),
    db.candidate.findMany({
      where: { conversations: { none: {} } },
      select: {
        id: true,
        fullName: true,
        nickname: true,
        sourceChannel: true,
        currentStatus: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <InboxClient
      initialConversations={conversations as any}
      quickReplies={quickReplies}
      candidatesWithoutConversation={candidates}
      currentUser={{ id: session?.user?.id ?? "", name: session?.user?.name ?? "" }}
    />
  );
}
