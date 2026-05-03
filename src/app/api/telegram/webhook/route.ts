import { db } from "@/lib/db";
import { pushMessage } from "@/lib/line";
import { NextResponse } from "next/server";

const TOPIC_ID = parseInt(process.env.TELEGRAM_TOPIC_ID ?? "522");

export async function POST(req: Request) {
  const update = await req.json();
  const message = update.message;

  if (!message?.text) return NextResponse.json({ ok: true });

  // เฉพาะ topic 522 เท่านั้น
  if (message.message_thread_id !== TOPIC_ID) return NextResponse.json({ ok: true });

  // ข้ามข้อความที่เราส่งเอง (มี marker "📩 LINE |")
  if (message.text.startsWith("📩 LINE |")) return NextResponse.json({ ok: true });

  // ต้องเป็น reply ถึงจะรู้ว่า reply ให้ใคร
  const replyToId = message.reply_to_message?.message_id;
  if (!replyToId) return NextResponse.json({ ok: true });

  // ค้นหา mapping จาก DB
  const mapping = await db.setting.findUnique({
    where: { key: `tg_reply.${replyToId}` },
  });

  let lineUserId: string | null = null;
  let conversationId: string | null = null;

  if (mapping) {
    const [uid, cid] = mapping.value.split("|");
    lineUserId = uid;
    conversationId = cid;
    // cleanup mapping
    await db.setting.delete({ where: { key: `tg_reply.${replyToId}` } });
  } else {
    // fallback: parse lineUserId จาก reply_to_message text
    const match = message.reply_to_message?.text?.match(/📩 LINE \| (U[a-zA-Z0-9]+)/);
    if (!match) return NextResponse.json({ ok: true });
    lineUserId = match[1];
  }

  if (!lineUserId) return NextResponse.json({ ok: true });

  const danielReply = message.text.trim();

  // หา candidate
  const candidate = await db.candidate.findUnique({ where: { lineUserId } });
  if (!candidate) return NextResponse.json({ ok: true });

  // หา conversation
  const conversation = conversationId
    ? await db.conversation.findUnique({ where: { id: conversationId } })
    : await db.conversation.findFirst({
        where: { candidateId: candidate.id, status: { not: "CLOSED" } },
      });
  if (!conversation) return NextResponse.json({ ok: true });

  // บันทึก bot reply ลง DB
  await db.message.create({
    data: {
      conversationId: conversation.id,
      content: danielReply,
      senderType: "BOT",
    },
  });

  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  // ส่งกลับหา candidate ผ่าน LINE Push API
  try {
    await pushMessage(lineUserId, danielReply);
  } catch (err) {
    console.error("[telegram webhook] pushMessage failed:", err);
  }

  return NextResponse.json({ ok: true });
}
