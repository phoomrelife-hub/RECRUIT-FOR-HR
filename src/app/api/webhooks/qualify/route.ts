import { db } from "@/lib/db";
import { pushMessage } from "@/lib/line";
import { NextResponse } from "next/server";

// Called by Make.com scenario (instead of calling LINE directly)
// Payload:
// {
//   lineUserId: string        — LINE user ID to notify
//   result: string            — "pass" | "fail"  OR  "✅ ผ่าน" | "❌ ไม่ผ่าน"
// }
//
// Security: x-webhook-secret header must match WEBHOOK_QUALIFY_SECRET env var
//
// Flow:
//   1. Find candidate by lineUserId
//   2. Update status: QUALIFIED (pass) | REJECTED (fail)
//   3. Save LINE message to inbox (SYSTEM sender)
//   4. Send LINE push message via pushMessage()
//   5. Return { ok: true }
//
// Make.com still handles: PATCH Notion ส่งแจ้งผลแล้ว = true

const MSG_PASS = `หวัดดีค้าา~ 🎉
ยินดีด้วยนะคะ! ทางทีม Relife ได้พิจารณาใบสมัครของคุณแล้ว
และอยากเชิญคุณมาคุยกันเพิ่มเติมค่ะ 🥳
ทางทีมจะติดต่อกลับเพื่อนัดวันและเวลาสัมภาษณ์เร็วๆ นี้นะคะ 📅
ฝากติดตาม inbox ไว้ด้วยนะคะ~
ขอบคุณมากค่า ❤️
— ทีม Relife Solutions`;

const MSG_FAIL = `หวัดดีค้าา~ ขอบคุณมากๆ เลยนะคะที่สนใจมาร่วมทีม Relife 🥰
ทางทีมได้อ่านใบสมัครของคุณแล้วค่ะ ครั้งนี้อาจจะยังไม่ match กันพอดีซักนิด
แต่ไม่ได้แปลว่าไม่เก่งนะคะ 💪
ถ้าในอนาคตมีตำแหน่งที่ใช่ จะทักกลับมาเลยค่า ฝากติดตาม Relife ไว้ด้วยนะคะ 🌟
ขอบคุณอีกครั้งค้าา ❤️
— ทีม Relife Solutions`;

export async function POST(req: Request) {
  // ── auth ──────────────────────────────────────────────────────────────────
  const secret = req.headers.get("x-webhook-secret");
  if (
    process.env.WEBHOOK_QUALIFY_SECRET &&
    secret !== process.env.WEBHOOK_QUALIFY_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const lineUserId = typeof body.lineUserId === "string" ? body.lineUserId.trim() : "";
  const result = typeof body.result === "string" ? body.result.trim() : "";

  if (!lineUserId || !result) {
    return NextResponse.json(
      { error: "lineUserId and result are required" },
      { status: 400 }
    );
  }

  // ── determine pass/fail ───────────────────────────────────────────────────
  // Accept: "pass" | "✅ ผ่าน" | "✅" → pass
  //         "fail" | "❌ ไม่ผ่าน" | "❌" → fail
  const isPass =
    result === "pass" ||
    result.includes("✅") ||
    result.toLowerCase().startsWith("pass");

  const isFail =
    result === "fail" ||
    result.includes("❌") ||
    result.toLowerCase().startsWith("fail");

  if (!isPass && !isFail) {
    return NextResponse.json(
      { error: `Unknown result value: "${result}". Use "pass" or "fail"` },
      { status: 400 }
    );
  }

  // ── find candidate ────────────────────────────────────────────────────────
  const candidate = await db.candidate.findUnique({ where: { lineUserId } });
  if (!candidate) {
    return NextResponse.json(
      { error: `Candidate with lineUserId "${lineUserId}" not found` },
      { status: 404 }
    );
  }

  // ── update candidate status ───────────────────────────────────────────────
  const newStatus = isPass ? "QUALIFIED" : "REJECTED";
  const prevStatus = candidate.currentStatus;

  if (prevStatus !== newStatus) {
    await db.candidate.update({
      where: { id: candidate.id },
      data: { currentStatus: newStatus },
    });

    await db.candidateStatusHistory.create({
      data: {
        candidateId: candidate.id,
        fromStatus: prevStatus,
        toStatus: newStatus,
        reason: `Qualify result from Notion via Make.com: ${isPass ? "✅ ผ่าน" : "❌ ไม่ผ่าน"}`,
      },
    });
  }

  // ── find or create conversation ───────────────────────────────────────────
  let conversation = await db.conversation.findFirst({
    where: { candidateId: candidate.id, status: { not: "CLOSED" } },
    orderBy: { createdAt: "desc" },
  });
  if (!conversation) {
    conversation = await db.conversation.create({
      data: { candidateId: candidate.id, channel: "LINE" },
    });
  }

  // ── save message to inbox (appears as bot/system message) ────────────────
  const messageText = isPass ? MSG_PASS : MSG_FAIL;
  await db.message.create({
    data: {
      conversationId: conversation.id,
      content: messageText,
      senderType: "BOT",
      createdAt: new Date(),
    },
  });

  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), status: "ACTIVE" },
  });

  // ── send LINE push message ────────────────────────────────────────────────
  let lineSent = false;
  let lineError: string | null = null;
  try {
    await pushMessage(lineUserId, messageText);
    lineSent = true;
  } catch (err) {
    lineError = err instanceof Error ? err.message : String(err);
    console.error("[webhooks/qualify] LINE push failed:", lineError);
    // Don't throw — we still updated the DB. Make.com should NOT retry.
  }

  return NextResponse.json({
    ok: true,
    candidateId: candidate.id,
    status: newStatus,
    lineSent,
    ...(lineError ? { lineError } : {}),
  });
}
