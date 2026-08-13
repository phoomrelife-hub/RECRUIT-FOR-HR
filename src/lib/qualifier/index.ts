import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PROMPT_VERSION, QUALIFIER_MODEL, resolveOpenAiConfig, runAssessment } from "./assess";
import { resolveRubric } from "./rubric";
import { computeScore } from "./scoring";
import { gatherEvidence } from "./sources";
import type { Verdict } from "./types";

export * from "./types";
export { NoRubricError } from "./rubric";
export { AssessmentFormatError, MissingApiKeyError, resolveOpenAiConfig } from "./assess";

// PLACEHOLDER pricing, USD per million tokens — gpt-5.6-luna's real price is not
// known to us (ported from the old Claude Sonnet figures during the OpenAI
// port). Correct these against actual OpenAI billing before trusting any
// cost figure this module produces.
const PLACEHOLDER_INPUT_USD_PER_MTOK = 3;
const PLACEHOLDER_OUTPUT_USD_PER_MTOK = 15;

export function estimateCostUsd(usage: { input: number; output: number }): number {
  return (usage.input / 1e6) * PLACEHOLDER_INPUT_USD_PER_MTOK
       + (usage.output / 1e6) * PLACEHOLDER_OUTPUT_USD_PER_MTOK;
}

export function isStale(assessment: { inputHash: string }, currentHash: string): boolean {
  return assessment.inputHash !== currentHash;
}

export class CostLimitExceededError extends Error {
  constructor(spent: number, limit: number) {
    super(`เกินงบ AI ที่ตั้งไว้ (ใช้ไป $${spent.toFixed(2)} จากลิมิต $${limit.toFixed(2)})`);
    this.name = "CostLimitExceededError";
  }
}

export function periodStart(period: string, now: Date): Date {
  const d = new Date(now);
  if (period === "daily") {
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  if (period === "weekly") {
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - 7);
    return d;
  }
  // monthly (and anything unrecognised)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Guards the bulk backfill from running away. No active limit = no ceiling. */
async function assertUnderCostLimit(): Promise<void> {
  const limit = await db.aiCostLimit.findFirst({ where: { isActive: true } });
  if (!limit) return;

  const spent = await db.aiLog.aggregate({
    _sum: { costEstimate: true },
    where: { createdAt: { gte: periodStart(limit.period, new Date()) } },
  });

  const total = spent._sum.costEstimate ?? 0;
  if (total >= limit.limitUsd) throw new CostLimitExceededError(total, limit.limitUsd);
}

/**
 * Gather evidence → resolve rubric → one OpenAI call → compute score → persist.
 * Throws before writing anything if any step fails. Never touches currentStatus.
 */
export async function assessCandidate(
  candidateId: string,
): Promise<{ id: string; overallScore: number; verdict: Verdict }> {
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true, fullName: true, nickname: true,
      notionPageId: true, interestedPositionId: true,
    },
  });
  if (!candidate) throw new Error("ไม่พบผู้สมัคร");

  await assertUnderCostLimit();

  const evidence = await gatherEvidence(candidate);
  const rubric = await resolveRubric(candidate.interestedPositionId);

  const started = Date.now();
  let result: Awaited<ReturnType<typeof runAssessment>>;
  try {
    result = await runAssessment(evidence, rubric);
  } catch (err) {
    // runAssessment threw before returning, so there's no resolved model on a
    // `result` to log — best-effort re-resolve it (cheap: Setting reads, no
    // network call) purely for this log row. Falls back to the code default
    // if resolution itself is what failed (e.g. MissingApiKeyError), since in
    // that case no model was ever actually used.
    const model = await resolveOpenAiConfig().then((c) => c.model).catch(() => QUALIFIER_MODEL);
    await db.aiLog.create({
      data: {
        model, action: "qualifier", candidateId,
        success: false, errorMessage: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - started,
      },
    });
    throw err;
  }

  const { output, usage, model } = result;
  const { overallScore, coveragePct, verdict } = computeScore(rubric.criteria, output.criteria);
  const costUsd = estimateCostUsd(usage);

  const scoreByName = new Map(output.criteria.map((c) => [c.name, c]));

  const saved = await db.$transaction(async (tx) => {
    // Shared by create and update — the brief's upsert had byte-identical payloads
    // for both branches, which is a pre-approved extraction to avoid duplication.
    const payload = {
      jobPositionId: candidate.interestedPositionId,
      rubricConfigId: rubric.configId,
      overallScore, coveragePct, verdict,
      summary: output.summary,
      strengths: output.strengths || null,
      concerns: output.concerns || null,
      redFlags: output.redFlags || null,
      unverifiedClaims: output.unverifiedClaims || null,
      sourcesUsed: evidence.sources as unknown as Prisma.InputJsonValue,
      interviewQuestions: output.interviewQuestions as unknown as Prisma.InputJsonValue,
      model,
      promptVersion: PROMPT_VERSION,
      inputHash: evidence.inputHash,
      costUsd,
    };

    const assessment = await tx.candidateAssessment.upsert({
      where: { candidateId },
      create: { candidateId, ...payload },
      update: payload,
    });

    // Rewrite criterion rows so a re-run never leaves stale criteria behind.
    await tx.assessmentCriterionScore.deleteMany({ where: { assessmentId: assessment.id } });
    await tx.assessmentCriterionScore.createMany({
      data: rubric.criteria.map((c, i) => ({
        assessmentId: assessment.id,
        name: c.name,
        weight: c.weight,
        // Belt and braces: the model's output is not ours to control — even
        // though assessmentSchema already enforces an integer, round again
        // here so a value that somehow slips past validation still cannot
        // fail this write (score is Int? in the DB).
        score: scoreByName.get(c.name)?.score != null
          ? Math.round(scoreByName.get(c.name)!.score!)
          : null,
        reasoning: scoreByName.get(c.name)?.reasoning ?? "AI ไม่ได้ประเมินเกณฑ์นี้",
        sortOrder: i,
      })),
    });

    return assessment;
  });

  await db.aiLog.create({
    data: {
      model, action: "qualifier", candidateId,
      promptTokens: usage.input, outputTokens: usage.output,
      totalTokens: usage.input + usage.output,
      costEstimate: costUsd, latencyMs: Date.now() - started, success: true,
    },
  });

  return { id: saved.id, overallScore, verdict };
}
