import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const convs = await db.conversation.findMany({
    where: { unreadCount: { gt: 0 } },
    select: {
      id: true,
      unreadCount: true,
      lastMessageAt: true,
      botEnabled: true,
      channel: true,
      candidate: {
        select: {
          fullName: true,
          nickname: true,
          lineDisplayName: true,
          lineProfilePicUrl: true,
        },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  const total = convs.reduce((s, c) => s + c.unreadCount, 0);

  return NextResponse.json(
    { total, conversations: convs },
    { headers: { "Cache-Control": "no-store" } }
  );
}
