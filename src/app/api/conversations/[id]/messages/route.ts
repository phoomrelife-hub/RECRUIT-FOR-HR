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

  const text = parsed.data.content;

  // Push to the real channel FIRST. If it fails nothing is saved and the client
  // gets a 502, so the UI shows a failed bubble and a retry can never duplicate
  // a stored-but-undelivered message. (Our own FB echoes are skipped by
  // lib/fb-echo.ts, so saving after the push cannot double-record.)
  if (conversation.channel === "LINE" && conversation.candidate.lineUserId) {
    try {
      await pushMessage(conversation.candidate.lineUserId, text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[LINE push] failed:", msg);
      return NextResponse.json({ error: msg, channel: "LINE" }, { status: 502 });
    }
  } else if (conversation.channel === "FACEBOOK" && conversation.candidate.facebookUserId) {
    try {
      await sendFbMessage(conversation.candidate.facebookUserId, text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[FB push] failed:", msg);
      return NextResponse.json({ error: msg, channel: "FACEBOOK" }, { status: 502 });
    }
  }

  const message = await db.message.create({
    data: {
      conversationId: id,
      content: text,
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

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "SEND_MESSAGE",
      targetId: id,
      targetType: "Conversation",
    },
  });

  return NextResponse.json(message, { status: 201 });
}
