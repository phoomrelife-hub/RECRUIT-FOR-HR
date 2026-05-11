import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const MONTH_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const BKK_MS = 7 * 3600 * 1000; // UTC+7

type Bucket = { label: string; start: Date; end: Date };

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "monthly";

  // Bangkok "now" — use UTC fields as Bangkok fields
  const nowUtc = new Date();
  const bkk = new Date(nowUtc.getTime() + BKK_MS);
  const bkkYear  = bkk.getUTCFullYear();
  const bkkMonth = bkk.getUTCMonth();
  const bkkDay   = bkk.getUTCDate();

  // Bangkok midnight → UTC equivalent  (BKK 00:00 = UTC 17:00 prev day)
  const todayMidUtc = new Date(Date.UTC(bkkYear, bkkMonth, bkkDay) - BKK_MS);

  const buckets: Bucket[] = [];

  if (period === "daily") {
    // 30 daily buckets, j=0 = 29 days ago, j=29 = today
    for (let j = 0; j < 30; j++) {
      const start = new Date(todayMidUtc.getTime() - (29 - j) * 86400000);
      const end   = new Date(start.getTime() + 86400000);
      const bkkStart = new Date(start.getTime() + BKK_MS);
      buckets.push({
        label: `${bkkStart.getUTCDate()} ${MONTH_SHORT[bkkStart.getUTCMonth()]}`,
        start,
        end,
      });
    }

  } else if (period === "weekly") {
    // 12 weekly buckets (7-day blocks), j=0 = oldest (77-83 days ago), j=11 = current week
    for (let j = 0; j < 12; j++) {
      const start = new Date(todayMidUtc.getTime() - (11 - j + 1) * 7 * 86400000);
      const end   = new Date(todayMidUtc.getTime() - (11 - j)     * 7 * 86400000);
      const bkkStart = new Date(start.getTime() + BKK_MS);
      const bkkEnd   = new Date(end.getTime()   + BKK_MS - 1);
      const sD = bkkStart.getUTCDate(), sM = bkkStart.getUTCMonth();
      const eD = bkkEnd.getUTCDate(),   eM = bkkEnd.getUTCMonth();
      // Label: "5-11 พ.ค." or "28 เม.ย.-4 พ.ค." if month changes
      const label = sM === eM
        ? `${sD}-${eD} ${MONTH_SHORT[sM]}`
        : `${sD} ${MONTH_SHORT[sM]}-${eD} ${MONTH_SHORT[eM]}`;
      buckets.push({ label, start, end });
    }

  } else {
    // monthly: 6 months, j=0 = 5 months ago, j=5 = current month
    for (let j = 0; j < 6; j++) {
      const offset = -(5 - j); // -5 … 0
      const start = new Date(Date.UTC(bkkYear, bkkMonth + offset,     1) - BKK_MS);
      const end   = new Date(Date.UTC(bkkYear, bkkMonth + offset + 1, 1) - BKK_MS);
      const bkkStart = new Date(start.getTime() + BKK_MS);
      buckets.push({ label: MONTH_SHORT[bkkStart.getUTCMonth()], start, end });
    }
  }

  // Fetch candidates in range
  const rangeStart = buckets[0].start;
  const rangeEnd   = buckets[buckets.length - 1].end;

  const candidates = await db.candidate.findMany({
    where: { createdAt: { gte: rangeStart, lt: rangeEnd } },
    select: { createdAt: true },
  });

  // Assign each candidate to the correct bucket
  const counts = new Map<number, number>(buckets.map((_, i) => [i, 0]));
  for (const c of candidates) {
    const t = c.createdAt.getTime();
    for (let i = 0; i < buckets.length; i++) {
      if (t >= buckets[i].start.getTime() && t < buckets[i].end.getTime()) {
        counts.set(i, (counts.get(i) ?? 0) + 1);
        break;
      }
    }
  }

  const data = buckets.map((b, i) => ({ label: b.label, count: counts.get(i) ?? 0 }));
  const total = data.reduce((s, d) => s + d.count, 0);

  return NextResponse.json(
    { data, period, total },
    { headers: { "Cache-Control": "no-store" } },
  );
}
