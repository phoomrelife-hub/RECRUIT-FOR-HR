import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InboxClient } from "./inbox-client";

export default async function InboxPage() {
  const session = await auth();

  // Only fetch conversations server-side — the most critical data for initial render.
  // Secondary data (quickReplies, tags, hrUsers, candidatesWithoutConversation)
  // is fetched client-side after hydration to keep TTFB fast.
  const conversations = await db.conversation.findMany({
    include: {
      candidate: {
        select: {
          id: true,
          fullName: true,
          nickname: true,
          phone: true,
          lineDisplayName: true,
          lineProfilePicUrl: true,
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
    take: 100,
  });

  return (
    <InboxClient
      initialConversations={conversations as any}
      quickReplies={[]}
      candidatesWithoutConversation={[]}
      currentUser={{ id: session?.user?.id ?? "", name: session?.user?.name ?? "" }}
      allTags={[]}
      hrUsers={[]}
    />
  );
}
