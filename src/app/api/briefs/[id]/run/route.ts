import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { AiNotConfiguredError, resolveAiConfig } from "@/lib/brief/ai";
import { scoreForBrief } from "@/lib/brief/run";
import { notifyPending } from "@/lib/brief/notify";
import type { CandidateStatus } from "@prisma/client";

// POST /api/briefs/[id]/run
// body: { statuses?: CandidateStatus[], candidateIds?: string[], limit?: number, dryRun?: boolean }
//
// Scores candidates against a brief. Spends money, so it is explicit rather
// than automatic: `dryRun` reports what WOULD be scored, and `limit` is capped.

/** The bot's own "I have finished screening" signal — the default target. */
const DEFAULT_STATUSES: CandidateStatus[] = ["WAITING_HR_REVIEW"];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

/**
 * Rough per-candidate spend, used only for the dry-run estimate.
 * Measured against a ~1,500-token transcript on a flash-tier model; the real
 * figure is recorded per row in `candidate_brief_scores.cost_usd`.
 */
const EST_USD_PER_CANDIDATE = 0.0008;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const brief = await db.hiringBrief.findUnique({ where: { id } });
  if (!brief) return NextResponse.json({ error: "ไม่พบบรีฟ" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun !== false; // default to a dry run — spending is opt-in
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number(body.limit) || DEFAULT_LIMIT));
  const statuses: CandidateStatus[] = Array.isArray(body.statuses) && body.statuses.length
    ? body.statuses
    : DEFAULT_STATUSES;

  const where = Array.isArray(body.candidateIds) && body.candidateIds.length
    ? { id: { in: body.candidateIds as string[] } }
    : {
        currentStatus: { in: statuses },
        // Skip anyone already scored against this exact brief — they would
        // return from cache anyway, but excluding them keeps `limit` meaning
        // "candidates actually worked on" rather than "rows looked at".
        briefScores: { none: { briefId: brief.id, briefHash: brief.briefHash } },
      };

  const total = await db.candidate.count({ where });
  const candidates = await db.candidate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true },
  });

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      pending: total,
      wouldScore: candidates.length,
      estimatedUsd: Number((candidates.length * EST_USD_PER_CANDIDATE).toFixed(4)),
    });
  }

  let config;
  try {
    config = await resolveAiConfig();
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  let scored = 0;
  let filtered = 0;
  let cached = 0;
  let failed = 0;
  let spend = 0;
  const stars: Record<number, number> = {};

  // Sequential on purpose. Firing 500 concurrent requests at a flash-tier model
  // trips rate limits, and a half-finished parallel run is harder to reason
  // about than a slower complete one.
  for (const c of candidates) {
    try {
      const out = await scoreForBrief(c.id, brief, config);
      spend += out.costUsd;
      if (out.cached) cached++;
      else if (out.filteredOut) filtered++;
      else {
        scored++;
        stars[out.stars] = (stars[out.stars] ?? 0) + 1;
      }
    } catch {
      // One unreadable transcript must not abandon the other 499.
      failed++;
    }
  }

  // Push the strong finds out now rather than waiting for the 09:00 digest —
  // that is the whole point of the instant tier. Everything below the
  // threshold is left for the daily roll-up so HR is not pinged 54 times.
  // A Lark failure here must not fail the run: the scores are already saved,
  // and the digest cron retries anything still unnotified.
  let notified = 0;
  try {
    const summary = await notifyPending(true);
    notified = summary.instantSent;
  } catch {
    notified = 0;
  }

  return NextResponse.json({
    dryRun: false,
    processed: candidates.length,
    scored,
    filteredOut: filtered,
    cached,
    failed,
    remaining: Math.max(0, total - candidates.length),
    starBreakdown: stars,
    notified,
    costUsd: Number(spend.toFixed(4)),
  });
}
