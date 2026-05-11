import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await db.conversation.updateMany({
    where: { unreadCount: { gt: 0 } },
    data: { unreadCount: 0 },
  });

  return NextResponse.json({ cleared: count });
}
