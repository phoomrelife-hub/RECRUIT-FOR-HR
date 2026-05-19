import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CalendarClient } from "./calendar-client";
import { CalendarDays } from "lucide-react";

export default async function CalendarPage() {
  await auth();

  // Fetch current month's interviews server-side
  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const start  = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`);
  const endUtc = new Date(start);
  endUtc.setUTCMonth(endUtc.getUTCMonth() + 1);

  const interviews = await db.interview.findMany({
    where: {
      status: "SCHEDULED",
      interviewDate: { gte: start, lt: endUtc },
    },
    select: {
      id: true,
      interviewDate: true,
      startTime: true,
      endTime: true,
      interviewType: true,
      location: true,
      meetingLink: true,
      candidateResponse: true,
      note: true,
      candidate: {
        select: {
          id: true,
          fullName: true,
          nickname: true,
          lineDisplayName: true,
          lineProfilePicUrl: true,
          interestedPosition: { select: { title: true } },
          conversations: {
            select: { id: true },
            orderBy: { lastMessageAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  // Group by Bangkok date key (UTC+7)
  const days: Record<string, typeof interviews> = {};
  for (const iv of interviews) {
    const bkk = new Date(iv.interviewDate.getTime() + 7 * 60 * 60 * 1000);
    const key = bkk.toISOString().slice(0, 10);
    if (!days[key]) days[key] = [];
    days[key].push(iv);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">ปฏิทินนัดสัมภาษณ์</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">ภาพรวมการนัดหมายประจำเดือน</p>
      </div>

      <CalendarClient days={days as any} year={year} month={month} />
    </div>
  );
}
