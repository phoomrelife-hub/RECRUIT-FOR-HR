import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where = {
    ...(status && status !== "ALL" ? { status: status as any } : {}),
    ...(search
      ? {
          candidate: {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { nickname: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
            ],
          },
        }
      : {}),
  };

  const conversations = await db.conversation.findMany({
    where,
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
        select: {
          id: true,
          content: true,
          senderType: true,
          createdAt: true,
        },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { candidateId, channel } = body;
  if (!candidateId || !channel) {
    return NextResponse.json({ error: "candidateId and channel required" }, { status: 400 });
  }

  const existing = await db.conversation.findFirst({
    where: { candidateId, status: { not: "CLOSED" } },
  });
  if (existing) return NextResponse.json(existing);

  const conversation = await db.conversation.create({
    data: { candidateId, channel },
  });

  return NextResponse.json(conversation, { status: 201 });
}
