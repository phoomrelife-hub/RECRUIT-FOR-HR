import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { pushMessageWithQuickReply } from "@/lib/line";
import { NextResponse } from "next/server";

// POST /api/candidates/[id]/schedule-interview
// Body: { type, date, startTime, location?, note?, meetingLink?, interviewer?, positionLabel? }
// type: "onsite" | "online"

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

  const type         = typeof body.type === "string" ? body.type : "onsite";
  const date         = typeof body.date === "string" ? body.date.trim() : "";
  const startTime    = typeof body.startTime === "string" ? body.startTime.trim() : "";
  const note         = typeof body.note === "string" ? body.note.trim() : undefined;
  const location     = typeof body.location === "string" && body.location.trim()
    ? body.location.trim()
    : "76/4 อาคารแพลตินัมเพลส ซอยรามคำแหง 178 เขตมีนบุรี กรุงเทพฯ";
  const meetingLink  = typeof body.meetingLink === "string" ? body.meetingLink.trim() : "";
  const interviewer  = typeof body.interviewer === "string" ? body.interviewer.trim() : "";
  const positionLabel = typeof body.positionLabel === "string" ? body.positionLabel.trim() : "";

  if (!date || !startTime) {
    return NextResponse.json({ error: "date and startTime required" }, { status: 400 });
  }
  if (type === "online" && !meetingLink) {
    return NextResponse.json({ error: "meetingLink required for online interview" }, { status: 400 });
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
      interestedPosition: { select: { title: true } },
    },
  });

  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const name = candidate.fullName ?? candidate.nickname ?? candidate.lineDisplayName ?? "คุณ";
  const prevStatus = candidate.currentStatus;
  const posTitle = positionLabel || candidate.interestedPosition?.title || "";

  // ── Format date ──────────────────────────────────────────────────────────
  const [y, m, d2] = date.split("-");
  const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const thDate = `${parseInt(d2)} ${thMonths[parseInt(m) - 1]} ${parseInt(y) + 543}`;

  // ── Create interview record ──────────────────────────────────────────────
  await db.interview.create({
    data: {
      candidateId:   candidate.id,
      jobPositionId: candidate.interestedPositionId ?? undefined,
      interviewDate: new Date(`${date}T${startTime}:00`),
      startTime,
      endTime:       startTime,
      interviewType: type === "online" ? "ONLINE" : "ONSITE",
      location:      type === "onsite" ? location : undefined,
      meetingLink:   type === "online" ? meetingLink : undefined,
      note:          note || undefined,
      createdById:   (session.user as { id?: string })?.id ?? undefined,
    },
  });

  // ── Update candidate status ──────────────────────────────────────────────
  await db.candidate.update({
    where: { id },
    data: { currentStatus: "INTERVIEW_SCHEDULED" },
  });

  const typeLabel = type === "online" ? "ออนไลน์" : "on-site";
  await db.candidateStatusHistory.create({
    data: {
      candidateId: id,
      fromStatus:  prevStatus,
      toStatus:    "INTERVIEW_SCHEDULED",
      reason:      `นัดสัมภาษณ์${typeLabel}วันที่ ${thDate} เวลา ${startTime} น.`,
    },
  });

  // ── Send LINE push + Quick Reply ─────────────────────────────────────────
  let lineSent = false;
  if (candidate.lineUserId) {
    let msgText: string;

    if (type === "online") {
      msgText = [
        `🎉 ยินดีด้วยนะคะ ${name}!`,
        ``,
        `ทางทีม Relife ขอนัดสัมภาษณ์ออนไลน์คุณดังนี้ค่ะ 💻✨`,
        ...(posTitle     ? [`💼 ตำแหน่ง: ${posTitle}`]      : []),
        ...(interviewer  ? [`👤 ผู้สัมภาษณ์: ${interviewer}`] : []),
        `📅 วันที่: ${thDate}`,
        `🕐 เวลา: ${startTime} น.`,
        `🔗 ลิงก์: ${meetingLink}`,
        ...(note ? [``, `📝 ${note}`] : []),
        ``,
        `กรุณายืนยันด้านล่างนะคะ 🙏`,
      ].join("\n");
    } else {
      msgText = [
        `🎉 ยินดีด้วยนะคะ ${name}!`,
        ``,
        `ทางทีม Relife ขอนัดสัมภาษณ์คุณดังนี้ค่ะ ✨`,
        ...(posTitle ? [`💼 ตำแหน่ง: ${posTitle}`] : []),
        `📅 วันที่: ${thDate}`,
        `🕐 เวลา: ${startTime} น.`,
        ``,
        `📍 สถานที่ตั้งบริษัท:`,
        `${location}`,
        `🗺 Google Map: https://goo.gl/maps/m7YAk58PxNW4fvXZ6`,
        ``,
        `🌐 เว็บไซต์: https://www.relife.co.th/`,
        ...(note ? [``, `📝 ${note}`] : []),
        ``,
        `📞 สอบถามเพิ่มเติม: 082-474-4442 หรือ Line: @relifejob`,
        ``,
        `กรุณายืนยันด้านล่างนะคะ 🙏`,
      ].join("\n");
    }

    try {
      await pushMessageWithQuickReply(candidate.lineUserId, msgText, [
        { label: "✅ สะดวก",     text: "สะดวก" },
        { label: "❌ ไม่สะดวก", text: "ไม่สะดวก" },
      ]);
      lineSent = true;
    } catch (err) {
      console.error("LINE push failed:", err);
    }
  }

  return NextResponse.json({ ok: true, lineSent });
}
