import { db } from "@/lib/db";
import { notifyCandidateWithQuickReply } from "@/lib/notify";
import { NextResponse } from "next/server";

// POST /api/cron/interview-reminders
// Called by Vercel Cron every morning at 07:00 Bangkok time (00:00 UTC)
// Sends LINE reminder to candidates whose interview is TODAY and reminder not yet sent

export async function GET(req: Request) {
  // ── Auth: Vercel passes Authorization: Bearer <CRON_SECRET> ──────────────
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Find today's interviews (Bangkok UTC+7) ──────────────────────────────
  // Get today's date in Bangkok time
  const now = new Date();
  const bkkNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = bkkNow.getUTCFullYear();
  const mm   = bkkNow.getUTCMonth(); // 0-based
  const dd   = bkkNow.getUTCDate();

  // UTC range covering Bangkok "today" (00:00–23:59 BKK = 17:00 prev UTC – 16:59 UTC)
  const dayStartUTC = new Date(Date.UTC(yyyy, mm, dd) - 7 * 60 * 60 * 1000);
  const dayEndUTC   = new Date(Date.UTC(yyyy, mm, dd + 1) - 7 * 60 * 60 * 1000);

  const interviews = await db.interview.findMany({
    where: {
      status: "SCHEDULED",
      reminderSentAt: null, // not yet reminded
      candidateResponse: { not: "declined" }, // skip declined
      interviewDate: { gte: dayStartUTC, lt: dayEndUTC },
    },
    select: {
      id: true,
      startTime: true,
      interviewType: true,
      location: true,
      meetingLink: true,
      interviewDate: true,
      candidate: {
        select: {
          id: true,
          fullName: true,
          nickname: true,
          lineDisplayName: true,
          lineUserId: true,
          facebookUserId: true,
          interestedPosition: { select: { title: true } },
        },
      },
    },
  });

  if (interviews.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "ไม่มีนัดวันนี้" });
  }

  // ── Thai date helpers ──────────────────────────────────────────────────────
  const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const bkkDate = new Date(dayStartUTC.getTime() + 7 * 60 * 60 * 1000);
  const thDate = `${bkkDate.getUTCDate()} ${thMonths[bkkDate.getUTCMonth()]} ${bkkDate.getUTCFullYear() + 543}`;

  // ── Send reminders ─────────────────────────────────────────────────────────
  let sent = 0;
  let skipped = 0;

  for (const iv of interviews) {
    const c = iv.candidate;
    const name = c.fullName ?? c.nickname ?? c.lineDisplayName ?? "คุณ";
    const isOnline = iv.interviewType === "ONLINE";

    if (!c.lineUserId && !c.facebookUserId) {
      skipped++;
      continue;
    }

    const msgLines = [
      `สวัสดีค่ะ คุณ${name} 👋`,
      ``,
      `เตือนความจำนะคะ วันนี้มีนัดสัมภาษณ์กับทีม Relife ค่ะ ✨`,
      ...(c.interestedPosition ? [`💼 ตำแหน่ง: ${c.interestedPosition.title}`] : []),
      `📅 วันที่: ${thDate}`,
      `🕐 เวลา: ${iv.startTime} น.`,
    ];

    if (isOnline && iv.meetingLink) {
      msgLines.push(`🔗 ลิงก์: ${iv.meetingLink}`);
    } else if (!isOnline && iv.location) {
      msgLines.push(`📍 สถานที่: ${iv.location}`);
    }

    msgLines.push(``, `ขอให้โชคดีนะคะ 🍀`, `— ทีม Relife Solutions`);

    try {
      await notifyCandidateWithQuickReply(c, msgLines.join("\n"), [
        { label: "✅ สะดวก",    text: "สะดวก" },
        { label: "❌ ไม่สะดวก", text: "ไม่สะดวก" },
      ], { fbTag: "CONFIRMED_EVENT_UPDATE" });
      // Mark reminder as sent
      await db.interview.update({
        where: { id: iv.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    } catch (err) {
      console.error(`[reminder] failed for interview ${iv.id}:`, err);
      skipped++;
    }
  }

  console.log(`[interview-reminders] sent=${sent} skipped=${skipped} date=${thDate}`);
  return NextResponse.json({ ok: true, sent, skipped, date: thDate });
}
