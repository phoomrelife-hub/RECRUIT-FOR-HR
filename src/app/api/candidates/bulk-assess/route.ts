import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assessCandidate, estimateCostUsd } from "@/lib/qualifier";
import { NextResponse } from "next/server";

export const maxDuration = 300;

// This endpoint is meant to be called repeatedly, not once with a huge limit.
// Each assessment is a Claude vision call over a PDF (~20s worst case). The
// ceiling is sized to leave real headroom inside maxDuration rather than race
// it: 12 candidates × 20s = 240s, ~80% of the 300s budget. A batch that hits
// the timeout mid-run would leave assessments written (money spent) but no
// response — no succeeded/failed/remaining breakdown for the operator — so we
// keep batches small and let `remaining` in the response tell the caller to
// run it again.
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 12;

// Rough per-candidate usage, used only for the dry-run cost estimate.
const TYPICAL_USAGE = { input: 8000, output: 1500 };

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN" && session?.user?.role !== "HR_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun: boolean = body.dryRun !== false; // default to dry run for safety
  const limit = Math.max(1, Math.min(Number(body.limit) || DEFAULT_LIMIT, MAX_LIMIT));

  const targets = await db.candidate.findMany({
    where: { notionPageId: { not: null }, assessment: { is: null } },
    select: { id: true, fullName: true, nickname: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const totalPending = await db.candidate.count({
    where: { notionPageId: { not: null }, assessment: { is: null } },
  });

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalPending,
      willProcess: targets.length,
      estimatedCostUsd: Number((estimateCostUsd(TYPICAL_USAGE) * targets.length).toFixed(2)),
      candidates: targets.map((c) => ({ id: c.id, name: c.fullName ?? c.nickname ?? "-" })),
    });
  }

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];

  // Sequential on purpose — parallel vision calls hit Anthropic rate limits fast.
  for (const target of targets) {
    try {
      await assessCandidate(target.id);
      succeeded.push(target.id);
    } catch (err) {
      failed.push({ id: target.id, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  const remaining = Math.max(0, totalPending - succeeded.length);

  return NextResponse.json({
    dryRun: false,
    totalPending,
    succeeded: succeeded.length,
    failed,
    remaining,
    // `remaining > 0` means the backlog isn't done — call this endpoint again
    // (same shape, no extra params needed) to process the next batch.
    message: remaining > 0
      ? `เหลืออีก ${remaining} รายการ — เรียก endpoint นี้ซ้ำเพื่อทำต่อ`
      : "ประเมินครบทุกรายการในคิวแล้ว",
  });
}
