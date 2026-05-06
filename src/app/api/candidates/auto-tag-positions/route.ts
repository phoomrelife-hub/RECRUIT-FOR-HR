import { db } from "@/lib/db";
import { autoTagByPosition } from "@/lib/auto-tag";
import { NextResponse } from "next/server";

// No auth — intended as an internal admin trigger
// Tag all candidates with their interestedPosition as a violet tag
export async function POST() {
  const candidates = await db.candidate.findMany({
    where: { interestedPositionId: { not: null } },
    select: { id: true, interestedPositionId: true },
  });

  let tagged = 0;
  let skipped = 0;

  for (const c of candidates) {
    try {
      await autoTagByPosition(c.id, c.interestedPositionId, null);
      tagged++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, total: candidates.length, tagged, skipped });
}
