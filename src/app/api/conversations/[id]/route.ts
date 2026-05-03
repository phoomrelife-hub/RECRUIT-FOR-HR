import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const conversation = await db.conversation.findUnique({
    where: { id },
    include: {
      candidate: {
        select: {
          id: true,
          fullName: true,
          nickname: true,
          phone: true,
          email: true,
          sourceChannel: true,
          currentStatus: true,
          interestedPosition: { select: { id: true, title: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { id: true, name: true, avatar: true } },
        },
      },
      takeovers: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { hr: { select: { id: true, name: true } } },
      },
    },
  });

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // mark as read
  if (conversation.unreadCount > 0) {
    await db.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
  }

  return NextResponse.json(conversation);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { status } = body;

  const updated = await db.conversation.update({
    where: { id },
    data: { ...(status ? { status } : {}) },
  });

  return NextResponse.json(updated);
}
