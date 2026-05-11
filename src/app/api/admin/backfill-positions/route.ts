import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// ── Shared fuzzy-match logic (same as webhooks/form/route.ts) ─────────────────
function normPos(s: string) {
  return s.toLowerCase().replace(/[\/\-]+/g, " ").replace(/\s+/g, " ").trim();
}

function fuzzyMatch(
  submittedTitle: string,
  positions: { id: string; title: string }[]
): { id: string; title: string } | undefined {
  const normSubmitted = normPos(submittedTitle);
  const prefix = normSubmitted.substring(0, 14);

  // Pass 1: normalized prefix contains
  let matched = positions.find((p) => {
    const normP = normPos(p.title);
    return normP.includes(prefix) || normSubmitted.includes(normPos(p.title).substring(0, 14));
  });

  // Pass 2: word overlap (≥4 chars)
  if (!matched) {
    const submittedWords = new Set(
      normSubmitted.split(" ").filter((w) => w.length >= 4)
    );
    let maxOverlap = 0;
    for (const p of positions) {
      const pWords = normPos(p.title).split(" ").filter((w) => w.length >= 4);
      const overlap = pWords.filter((w) => submittedWords.has(w)).length;
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        matched = p;
      }
    }
    if (maxOverlap === 0) matched = undefined;
  }

  return matched;
}

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

  // ── Extract position title from SYSTEM messages ───────────────────────────
  // System messages from form webhook look like:
  //   "📋 ใบสมัครจาก Google Form\nชื่อ: ...\nตำแหน่ง: Content Creator / Live Streamer"
  const POSITION_REGEX = /ตำแหน่ง:\s*(.+)/;

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
      const m = msg.content.match(POSITION_REGEX);
      if (m?.[1]) {
        extractedPosition = m[1].trim();
        break;
      }
    }

    if (!extractedPosition) continue; // no position hint in messages

    const matched = fuzzyMatch(extractedPosition, positions);
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
