import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assessCandidate, CostLimitExceededError, MissingApiKeyError, NoRubricError } from "@/lib/qualifier";
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
    // 422 = the operator must fix something (no rubric, no Notion page, no
    // OpenAI API key configured).
    // 429 = over the configured AI spend limit.
    // 502 = an upstream service failed; retrying may work.
    if (err instanceof NoRubricError || err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof CostLimitExceededError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    // Whatever the OpenAI call or a Notion fetch threw may contain URLs or
    // response bodies — log it server-side only, return a fixed Thai string.
    console.error("[qualifier] assessCandidate failed", id, err);
    return NextResponse.json({ error: "ประเมินไม่สำเร็จ — ระบบขัดข้อง ลองใหม่อีกครั้ง" }, { status: 502 });
  }

  const assessment = await db.candidateAssessment.findUnique({
    where: { candidateId: id },
    include: { criterionScores: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(assessment);
}
