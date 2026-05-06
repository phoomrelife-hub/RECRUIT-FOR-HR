import { db } from "@/lib/db";
import { getLineProfile } from "@/lib/line";
import { NextResponse } from "next/server";

// Internal endpoint — backfill LINE display name + profile pic for all candidates
// Called by: scripts/backfill_line_profiles.py (or manually via curl)
// Security: protected by OPENCLAW_SYNC_SECRET header (same as sync endpoint)

export async function POST(req: Request) {
  const secret = req.headers.get("x-openclaw-secret");
  if (
    process.env.OPENCLAW_SYNC_SECRET &&
    secret !== process.env.OPENCLAW_SYNC_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional: accept LINE token from request body (used when DB/env token not available)
  let lineTokenOverride: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    lineTokenOverride = body.lineToken;
  } catch { /* ignore */ }

  // Get all candidates with lineUserId
  const candidates = await db.candidate.findMany({
    where: { lineUserId: { not: null } },
    select: { id: true, lineUserId: true, nickname: true, lineDisplayName: true, lineProfilePicUrl: true },
  });

  const results = { updated: 0, skipped: 0, failed: 0 };

  for (const candidate of candidates) {
    if (!candidate.lineUserId) continue;

    try {
      let profile = await getLineProfile(candidate.lineUserId);

      // Fallback: use token override if DB/env token didn't work
      if (!profile?.displayName && lineTokenOverride) {
        const res = await fetch(`https://api.line.me/v2/bot/profile/${candidate.lineUserId}`, {
          headers: { Authorization: `Bearer ${lineTokenOverride}` },
        });
        if (res.ok) profile = await res.json();
      }

      if (!profile?.displayName) {
        results.skipped++;
        continue;
      }

      await db.candidate.update({
        where: { id: candidate.id },
        data: {
          lineDisplayName: profile.displayName,
          lineProfilePicUrl: (profile as any).pictureUrl ?? null,
          ...(candidate.nickname === "LINE User" ? { nickname: profile.displayName } : {}),
        },
      });
      results.updated++;
    } catch {
      results.failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    total: candidates.length,
    ...results,
  });
}
