import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const BOT_SCRIPT = [
  "สวัสดีครับ! ผมชื่อ Claw 🤖 ผู้ช่วย AI คัดกรองของ Relife ครับ\n\nตอนนี้เรากำลังเปิดรับสมัครงานหลายตำแหน่งครับ คุณสนใจสมัครตำแหน่งอะไรครับ?",
  "ขอบคุณครับ 🙏 ช่วยแนะนำตัวหน่อยนะครับ ชื่อ-นามสกุล และอายุของคุณครับ",
  "ยอดเยี่ยมเลยครับ! มีประสบการณ์ทำงานในสายงานนี้มาก่อนไหมครับ? ถ้ามีช่วยเล่าสั้นๆ ให้ฟังได้เลยครับ",
  "เข้าใจแล้วครับ 👍 อยากทราบเรื่องเงินเดือนที่ต้องการครับ คาดหวังไว้ประมาณเท่าไหร่ครับ?",
  "ได้เลยครับ แล้วสามารถเริ่มงานได้เร็วที่สุดเมื่อไหร่ครับ?",
  "ขอบคุณมากสำหรับข้อมูลครับ 🎉 ทีม HR จะทำการพิจารณาและติดต่อกลับโดยเร็วที่สุดครับ ขอให้โชคดีนะครับ! 😊",
];

const DEFAULT_BOT_REPLY =
  "ขอบคุณสำหรับข้อความนะครับ ทีม HR จะติดต่อกลับไปในเร็วๆ นี้ครับ 🙏";

export async function POST(req: Request) {
  const body = await req.json();
  // TEMP: log raw payload to inspect OpenClaw format
  console.log("[openclaw webhook] raw body:", JSON.stringify(body, null, 2));
  console.log("[openclaw webhook] headers:", Object.fromEntries(req.headers.entries()));
  const { candidateId, message, channel = "LINE" } = body;

  if (!candidateId || !message) {
    return NextResponse.json({ error: "candidateId and message required" }, { status: 400 });
  }

  const candidate = await db.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  // find or create conversation
  let conversation = await db.conversation.findFirst({
    where: { candidateId, status: { not: "CLOSED" } },
  });

  if (!conversation) {
    conversation = await db.conversation.create({
      data: { candidateId, channel },
    });
  }

  // save candidate message
  await db.message.create({
    data: {
      conversationId: conversation.id,
      content: message,
      senderType: "CANDIDATE",
    },
  });

  // count existing messages to determine bot script position
  const msgCount = await db.message.count({
    where: { conversationId: conversation.id },
  });

  await db.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      status: "ACTIVE",
      unreadCount: { increment: 1 },
    },
  });

  // update candidate to BOT_SCREENING if still NEW_APPLICANT
  if (candidate.currentStatus === "NEW_APPLICANT") {
    await db.candidate.update({
      where: { id: candidateId },
      data: { currentStatus: "BOT_SCREENING" },
    });
    await db.candidateStatusHistory.create({
      data: {
        candidateId,
        fromStatus: "NEW_APPLICANT",
        toStatus: "BOT_SCREENING",
        reason: "Bot conversation started",
      },
    });
  }

  // bot responds if enabled
  let botMessage = null;
  if (conversation.botEnabled) {
    // candidateMsgIndex: how many CANDIDATE messages have been sent (including this one)
    const candidateMsgCount = await db.message.count({
      where: { conversationId: conversation.id, senderType: "CANDIDATE" },
    });

    const botReplyContent =
      BOT_SCRIPT[candidateMsgCount - 1] ?? DEFAULT_BOT_REPLY;

    // small delay simulation: just save directly
    botMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        content: botReplyContent,
        senderType: "BOT",
      },
    });

    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
    });
  }

  return NextResponse.json({
    conversationId: conversation.id,
    botEnabled: conversation.botEnabled,
    botReplied: !!botMessage,
  });
}
