import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { pushMessage } from "@/lib/line";
import { NextResponse } from "next/server";

// POST /api/candidates/[id]/schedule-interview
// Body: { date, startTime, location?, note? }
// → creates Interview record + changes status to INTERVIEW_SCHEDULED + sends LINE

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const date      = typeof body.date === "string" ? body.date.trim() : "";
  const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";
  const location  = typeof body.location === "string" ? body.location.trim() : "76/4 อาคารแพลตินัมเพลส ซอยรามคำแหง 178 เขตมีนบุรี กรุงเทพฯ";
  const note      = typeof body.note === "string" ? body.note.trim() : undefined;

  if (!date || !startTime) {
    return NextResponse.json({ error: "date and startTime required" }, { status: 400 });
  }

  const candidate = await db.candidate.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      nickname: true,
      lineDisplayName: true,
      lineUserId: true,
      currentStatus: true,
      interestedPositionId: true,
    },
  });

  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const name = candidate.fullName ?? candidate.nickname ?? candidate.lineDisplayName ?? "คุณ";
  const prevStatus = candidate.currentStatus;

  // ── Format date for display ──────────────────────────────────────────────
  const [y, m, d2] = date.split("-");
  const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const thDate = `${parseInt(d2)} ${thMonths[parseInt(m) - 1]} ${parseInt(y) + 543}`;

  // ── Create interview record ──────────────────────────────────────────────
  await db.interview.create({
    data: {
      candidateId:    candidate.id,
      jobPositionId:  candidate.interestedPositionId ?? undefined,
      interviewDate:  new Date(`${date}T${startTime}:00`),
      startTime,
      endTime:        startTime, // will be updated later if needed
      location:       location || undefined,
      note:           note || undefined,
      createdById:    (session.user as { id?: string })?.id ?? undefined,
    },
  });

  // ── Update candidate status ──────────────────────────────────────────────
  await db.candidate.update({
    where: { id },
    data: { currentStatus: "INTERVIEW_SCHEDULED" },
  });

  await db.candidateStatusHistory.create({
    data: {
      candidateId: id,
      fromStatus:  prevStatus,
      toStatus:    "INTERVIEW_SCHEDULED",
      reason:      `นัดสัมภาษณ์วันที่ ${thDate} เวลา ${startTime} น.`,
    },
  });

  // ── Send LINE push message ───────────────────────────────────────────────
  let lineSent = false;
  if (candidate.lineUserId) {
    const lines = [
      `🎉 ยินดีด้วยนะคะ ${name}!`,
      ``,
      `ทางทีม Relife ขอนัดสัมภาษณ์คุณดังนี้ค่ะ ✨`,
      `📅 วันที่: ${thDate}`,
      `🕐 เวลา: ${startTime} น.`,
      `📍 สถานที่: ${location}`,
      ...(note ? [``, `📝 ${note}`] : []),
      ``,
      `กรุณาตอบกลับเพื่อยืนยัน หรือแจ้งหากไม่สะดวกได้เลยนะคะ 🙏`,
    ].join("\n");

    try {
      await pushMessage(candidate.lineUserId, lines);
      lineSent = true;
    } catch (err) {
      console.error("LINE push failed:", err);
    }
  }

  return NextResponse.json({ ok: true, lineSent });
}
