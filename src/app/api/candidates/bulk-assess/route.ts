import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assessCandidate, estimateCostUsd } from "@/lib/qualifier";
import { NextResponse } from "next/server";

export const maxDuration = 300;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

// Rough per-candidate usage, used only for the dry-run cost estimate.
const TYPICAL_USAGE = { input: 8000, output: 1500 };

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN" && session?.user?.role !== "HR_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun: boolean = body.dryRun !== false; // default to dry run for safety
  const limit = Math.min(Number(body.limit) || DEFAULT_LIMIT, MAX_LIMIT);

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

  return NextResponse.json({
    dryRun: false,
    totalPending,
    succeeded: succeeded.length,
    failed,
    remaining: Math.max(0, totalPending - succeeded.length),
  });
}
