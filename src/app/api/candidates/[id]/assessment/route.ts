import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assessCandidate, CostLimitExceededError, NoRubricError } from "@/lib/qualifier";
import { NextResponse } from "next/server";

export const maxDuration = 120; // PDF vision calls run long

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const assessment = await db.candidateAssessment.findUnique({
    where: { candidateId: id },
    include: { criterionScores: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(assessment);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await assessCandidate(id);
  } catch (err) {
    // 422 = the operator must fix something (no rubric, no Notion page).
    // 429 = over the configured AI spend limit.
    // 502 = an upstream service failed; retrying may work.
    const status = err instanceof NoRubricError ? 422
      : err instanceof CostLimitExceededError ? 429
      : 502;
    const message = err instanceof Error ? err.message : "ประเมินไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status });
  }

  const assessment = await db.candidateAssessment.findUnique({
    where: { candidateId: id },
    include: { criterionScores: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(assessment);
}
