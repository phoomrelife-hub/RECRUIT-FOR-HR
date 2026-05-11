import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { fuzzyMatchPosition, extractPositionFromMessage } from "@/lib/position-match";

// ── POST /api/admin/backfill-positions ────────────────────────────────────────
// Finds candidates without interestedPositionId, extracts position from their
// SYSTEM messages ("ตำแหน่ง: XXX"), fuzzy-matches to jobPosition, and updates.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow optional dryRun from body
  let dryRun = false;
  try {
    const body = await req.json().catch(() => ({}));
    dryRun = body.dryRun === true;
  } catch { /* ignore */ }

  // ── Fetch candidates without position ─────────────────────────────────────
  const candidates = await db.candidate.findMany({
    where: {
      interestedPositionId: null,
      currentStatus: {
        in: ["WAITING_HR_REVIEW", "BOT_SCREENING", "NEED_MORE_INFO", "NEW_APPLICANT"],
      },
    },
    select: {
      id: true,
      nickname: true,
      fullName: true,
      conversations: {
        select: {
          messages: {
            where: { senderType: "SYSTEM" },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { content: true },
          },
        },
      },
    },
  });

  // ── Fetch all active job positions ────────────────────────────────────────
  const positions = await db.jobPosition.findMany({
    where: { status: { in: ["OPEN", "DRAFT"] } },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });

  const results: {
    candidateId: string;
    name: string;
    extractedPosition: string;
    matchedPosition: string | null;
    updated: boolean;
  }[] = [];

  for (const candidate of candidates) {
    const allMessages = candidate.conversations.flatMap((c) => c.messages);
    let extractedPosition: string | null = null;

    for (const msg of allMessages) {
      const hint = extractPositionFromMessage(msg.content);
      if (hint) { extractedPosition = hint; break; }
    }

    if (!extractedPosition) continue;

    const matched = fuzzyMatchPosition(extractedPosition, positions);
    const name = candidate.fullName ?? candidate.nickname ?? candidate.id;

    if (matched && !dryRun) {
      await db.candidate.update({
        where: { id: candidate.id },
        data: { interestedPositionId: matched.id },
      });
    }

    results.push({
      candidateId: candidate.id,
      name,
      extractedPosition,
      matchedPosition: matched?.title ?? null,
      updated: !!matched && !dryRun,
    });
  }

  const fixed = results.filter((r) => r.matchedPosition !== null).length;
  const notFound = results.filter((r) => r.matchedPosition === null).length;
  const noHint = candidates.length - results.length;

  return NextResponse.json({
    dryRun,
    scanned: candidates.length,
    fixed,
    notFound,
    noHint,
    details: results,
  });
}
