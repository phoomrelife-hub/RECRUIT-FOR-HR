import { db } from "@/lib/db";
import { pushMessage } from "@/lib/line";
import { NextResponse } from "next/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScheduleSlot = {
  date: string;      // "YYYY-MM-DD" Bangkok date
  dateLabel: string; // "จ 20 ม.ค."
  startTime: string; // "09:00"
  endTime: string;   // "10:00"
};

export type ScheduleInfo = {
  candidateName: string;
  interviewType: string;
  slots: ScheduleSlot[];
};

// ── Slot generation ───────────────────────────────────────────────────────────

async function generateAvailableSlots(): Promise<ScheduleSlot[]> {
  const settingRows = await db.setting.findMany({
    where: {
      key: {
        in: [
          "schedule.start_hour",
          "schedule.end_hour",
          "schedule.slot_duration_min",
          "schedule.days_ahead",
          "schedule.weekdays",
        ],
      },
    },
  });
  const cfg = Object.fromEntries(settingRows.map((s) => [s.key, s.value]));

  const startHour    = parseInt(cfg["schedule.start_hour"]        ?? "9");
  const endHour      = parseInt(cfg["schedule.end_hour"]          ?? "17");
  const durationMin  = parseInt(cfg["schedule.slot_duration_min"] ?? "60");
  const daysAhead    = parseInt(cfg["schedule.days_ahead"]        ?? "7");
  const weekdays     = (cfg["schedule.weekdays"] ?? "1,2,3,4,5").split(",").map(Number);

  // Slots already taken (SCHEDULED + not declined)
  const booked = await db.interview.findMany({
    where: { status: "SCHEDULED", candidateResponse: { not: "declined" } },
    select: { interviewDate: true, startTime: true },
  });

  const taken = new Set(
    booked.map((iv) => {
      const bkk = new Date(iv.interviewDate.getTime() + 7 * 60 * 60 * 1000);
      const y = bkk.getUTCFullYear();
      const m = String(bkk.getUTCMonth() + 1).padStart(2, "0");
      const d = String(bkk.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}|${iv.startTime}`;
    })
  );

  const TH_DAYS   = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  const nowBkk = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const slots: ScheduleSlot[] = [];

  for (let offset = 1; offset <= daysAhead + 14 && slots.length < 25; offset++) {
    const day = new Date(nowBkk);
    day.setUTCDate(nowBkk.getUTCDate() + offset);

    if (!weekdays.includes(day.getUTCDay())) continue;

    const y  = day.getUTCFullYear();
    const mo = day.getUTCMonth();
    const da = day.getUTCDate();
    const dateStr   = `${y}-${String(mo + 1).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
    const dateLabel = `${TH_DAYS[day.getUTCDay()]} ${da} ${TH_MONTHS[mo]}`;

    for (let min = startHour * 60; min < endHour * 60; min += durationMin) {
      const sh = Math.floor(min / 60);
      const sm = min % 60;
      const em = min + durationMin;
      const eh = Math.floor(em / 60);
      const emm = em % 60;

      const startStr = `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`;
      const endStr   = `${String(eh).padStart(2, "0")}:${String(emm).padStart(2, "0")}`;

      if (!taken.has(`${dateStr}|${startStr}`)) {
        slots.push({ date: dateStr, dateLabel, startTime: startStr, endTime: endStr });
      }
    }
  }

  return slots;
}

// ── GET /api/schedule/[token] — validate token + return available slots ───────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const candidate = await db.candidate.findFirst({
    where: {
      scheduleToken: token,
      scheduleTokenExpiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      fullName: true,
      nickname: true,
      lineDisplayName: true,
      interviews: {
        where: { candidateResponse: "declined", status: "SCHEDULED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { interviewType: true },
      },
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }

  const slots = await generateAvailableSlots();

  return NextResponse.json({
    candidateName:
      candidate.fullName ?? candidate.nickname ?? candidate.lineDisplayName ?? "ผู้สมัคร",
    interviewType: candidate.interviews[0]?.interviewType ?? "ONSITE",
    slots,
  } satisfies ScheduleInfo);
}

// ── POST /api/schedule/[token] — book a slot ──────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { date, startTime, endTime } = (await req.json()) as {
    date: string;
    startTime: string;
    endTime: string;
  };

  const candidate = await db.candidate.findFirst({
    where: {
      scheduleToken: token,
      scheduleTokenExpiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      fullName: true,
      nickname: true,
      lineDisplayName: true,
      lineUserId: true,
      interviews: {
        where: { candidateResponse: "declined", status: "SCHEDULED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { interviewType: true, location: true, meetingLink: true },
      },
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }

  // Bangkok date → UTC interviewDate (Bangkok midnight = UTC 17:00 previous day)
  const [yr, mo, da] = date.split("-").map(Number);
  const interviewDate = new Date(Date.UTC(yr, mo - 1, da, -7, 0, 0));

  const prev = candidate.interviews[0];

  // Create new interview
  await db.interview.create({
    data: {
      candidateId:   candidate.id,
      interviewDate,
      startTime,
      endTime,
      interviewType: prev?.interviewType ?? "ONSITE",
      location:      prev?.location ?? null,
      meetingLink:   prev?.meetingLink ?? null,
      status:        "SCHEDULED",
    },
  });

  // Burn token (one-use)
  await db.candidate.update({
    where: { id: candidate.id },
    data: { scheduleToken: null, scheduleTokenExpiresAt: null },
  });

  // LINE confirmation
  if (candidate.lineUserId) {
    const name = candidate.fullName ?? candidate.nickname ?? candidate.lineDisplayName ?? "คุณ";
    const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const thDate = `${da} ${TH_MONTHS[mo - 1]} ${yr + 543}`;

    await pushMessage(
      candidate.lineUserId,
      `✅ ยืนยันนัดสัมภาษณ์ใหม่แล้วค่ะ คุณ${name} 🎉\n\n📅 วันที่: ${thDate}\n🕐 เวลา: ${startTime} - ${endTime} น.\n\nรอพบกันในวันนั้นนะคะ 😊\n— ทีม Relife Solutions`
    ).catch(() => null); // non-critical
  }

  return NextResponse.json({ ok: true });
}
