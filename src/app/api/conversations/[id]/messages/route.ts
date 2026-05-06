import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pushMessage } from "@/lib/line";
import { sendFbMessage } from "@/lib/facebook";
import { NextResponse } from "next/server";
import { z } from "zod";

const sendMessageSchema = z.object({
  content: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const conversation = await db.conversation.findUnique({
    where: { id },
    include: { candidate: { select: { lineUserId: true, facebookUserId: true } } },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const message = await db.message.create({
    data: {
      conversationId: id,
      content: parsed.data.content,
      senderType: "HR",
      senderId: session.user.id,
    },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
  });

  await db.conversation.update({
    where: { id },
    data: { lastMessageAt: new Date() },
  });

  // forward to real channel if connected
  let linePushError: string | null = null;
  if (conversation.channel === "LINE" && conversation.candidate.lineUserId) {
    try {
      await pushMessage(conversation.candidate.lineUserId, parsed.data.content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[LINE push] failed:", msg);
      linePushError = msg;
    }
  } else if (conversation.channel === "FACEBOOK" && conversation.candidate.facebookUserId) {
    try {
      await sendFbMessage(conversation.candidate.facebookUserId, parsed.data.content);
    } catch (err) {
      console.error("[FB push] failed:", err);
    }
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "SEND_MESSAGE",
      targetId: id,
      targetType: "Conversation",
    },
  });

  return NextResponse.json(
    { ...message, linePushError },
    { status: 201 }
  );
}
