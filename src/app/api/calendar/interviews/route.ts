import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/calendar/interviews?month=YYYY-MM
// Returns all SCHEDULED interviews grouped by date key

export async function GET(req: Request) {
  await auth();

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month"); // e.g. "2026-05"

  // Default to current month
  const now = new Date();
  const year  = monthParam ? parseInt(monthParam.split("-")[0]) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam.split("-")[1]) : now.getMonth() + 1;

  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`);
  const end   = new Date(year, month, 1); // first day of next month (local)
  // Use UTC end-of-month to avoid timezone gaps
  const endUtc = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`);
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
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  // Group by local date key YYYY-MM-DD (using Bangkok time UTC+7)
  const days: Record<string, typeof interviews> = {};
  for (const iv of interviews) {
    // Convert to UTC+7 for date key
    const bkk = new Date(iv.interviewDate.getTime() + 7 * 60 * 60 * 1000);
    const key = bkk.toISOString().slice(0, 10);
    if (!days[key]) days[key] = [];
    days[key].push(iv);
  }

  return NextResponse.json({ days }, { headers: { "Cache-Control": "no-store" } });
}
