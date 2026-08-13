import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const quickReplySchema = z.object({
  title: z.string().min(1).max(50),
  content: z.string().min(1).max(1000),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quickReplies = await db.quickReply.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ quickReplies });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role === "HR_STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = quickReplySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Append to the end. New templates must not silently take over one of the four
  // slots visible above the chat composer — HR promotes them deliberately.
  const max = await db.quickReply.aggregate({ _max: { sortOrder: true } });

  const quickReply = await db.quickReply.create({
    data: { ...parsed.data, sortOrder: (max._max.sortOrder ?? -1) + 1 },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE_QUICK_REPLY",
      targetId: quickReply.id,
      targetType: "QuickReply",
      detail: { title: quickReply.title },
    },
  });

  return NextResponse.json(quickReply, { status: 201 });
}
