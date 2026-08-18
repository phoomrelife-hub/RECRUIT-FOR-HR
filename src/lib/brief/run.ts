import { db } from "@/lib/db";
import type { HiringBrief, Prisma } from "@prisma/client";
import { resolveAiConfig, type AiConfig } from "./ai";
import { costUsd } from "./cost";
import { extractFacts, foundFields, type TranscriptMessage } from "./extract";
import { applyHardFilters } from "./filter";
import { scoreCandidate } from "./score";
import { toStars } from "./stars";
import { EMPTY_FACTS, type BriefCriterion, type ExtractedFacts, type HardFilters } from "./types";

/** Messages read per candidate. Long chats add cost without adding signal. */
const MAX_MESSAGES = 60;

/** Pull the hard-filter half back out of the row. */
export function briefFilters(b: HiringBrief): HardFilters {
  return {
    minAge: b.minAge,
    maxAge: b.maxAge,
    minSalary: b.minSalary,
    maxSalary: b.maxSalary,
    workPreference: b.workPreference,
    minExperienceYears: b.minExperienceYears,
    minSalesAmount: b.minSalesAmount,
  };
}

/** Pull the model-judged half back out of the row. */
export function briefCriteria(b: HiringBrief): BriefCriterion[] {
  const raw = b.criteria as unknown;
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter(
    (c): c is BriefCriterion =>
      !!c && typeof c === "object" && typeof (c as BriefCriterion).name === "string",
  );
}

async function loadMessages(candidateId: string): Promise<TranscriptMessage[]> {
  const rows = await db.message.findMany({
    where: { conversation: { candidateId } },
    orderBy: { createdAt: "asc" },
    take: MAX_MESSAGES,
    select: { senderType: true, content: true },
  });
  return rows.map((r) => ({ senderType: r.senderType, content: r.content }));
}

export interface ExtractionResult {
  facts: ExtractedFacts;
  /** False when a cached extraction was reused, meaning no API call was made. */
  called: boolean;
  costUsd: number;
}

/**
 * Make sure we know what a candidate's transcript says about them.
 *
 * Cached on message count: a conversation that has not grown since the last
 * extraction cannot contain new facts, so re-reading it is pure spend. This is
 * what stops a brief edit from costing a full re-extraction of 5,959 people.
 */
export async function ensureExtraction(
  candidateId: string,
  config?: AiConfig,
): Promise<ExtractionResult> {
  const [candidate, extraction, messageCount] = await Promise.all([
    db.candidate.findUnique({
      where: { id: candidateId },
      select: {
        age: true,
        workPreference: true,
        expectedSalary: true,
        maxSalesAmount: true,
        experienceText: true,
      },
    }),
    db.candidateExtraction.findUnique({ where: { candidateId } }),
    db.message.count({ where: { conversation: { candidateId } } }),
  ]);
  if (!candidate) throw new Error(`ไม่พบผู้สมัคร ${candidateId}`);

  if (extraction && extraction.messageCount >= messageCount) {
    return {
      facts: {
        age: candidate.age,
        workPreference: candidate.workPreference,
        expectedSalary: candidate.expectedSalary,
        experienceYears: extraction.experienceYears,
        maxSalesAmount: candidate.maxSalesAmount,
        experienceText: candidate.experienceText,
      },
      called: false,
      costUsd: 0,
    };
  }

  const messages = await loadMessages(candidateId);
  if (messages.length === 0) {
    return { facts: EMPTY_FACTS, called: false, costUsd: 0 };
  }

  const cfg = config ?? (await resolveAiConfig());
  const res = await extractFacts(messages, cfg);
  const spend = costUsd(res.model, res.promptTokens, res.completionTokens);

  // Only fill columns that are still empty. A value HR typed by hand, or that
  // came from Notion, outranks anything inferred from chat, and silently
  // overwriting it would make the record untrustworthy in both directions.
  const fill: Record<string, unknown> = {};
  if (candidate.age === null && res.facts.age !== null) fill.age = res.facts.age;
  if (candidate.workPreference === null && res.facts.workPreference !== null) {
    fill.workPreference = res.facts.workPreference;
  }
  if (candidate.expectedSalary === null && res.facts.expectedSalary !== null) {
    fill.expectedSalary = res.facts.expectedSalary;
  }
  if (candidate.maxSalesAmount === null && res.facts.maxSalesAmount !== null) {
    fill.maxSalesAmount = res.facts.maxSalesAmount;
  }
  if (!candidate.experienceText && res.facts.experienceText) {
    fill.experienceText = res.facts.experienceText;
  }

  await db.$transaction([
    ...(Object.keys(fill).length
      ? [db.candidate.update({ where: { id: candidateId }, data: fill })]
      : []),
    db.candidateExtraction.upsert({
      where: { candidateId },
      create: {
        candidateId,
        experienceYears: res.facts.experienceYears,
        foundFields: foundFields(res.facts),
        messageCount,
        model: res.model,
      },
      update: {
        experienceYears: res.facts.experienceYears,
        foundFields: foundFields(res.facts),
        messageCount,
        model: res.model,
        extractedAt: new Date(),
      },
    }),
  ]);

  // Report what the record now holds: an HR-entered value we declined to
  // overwrite is the truth for filtering, not the model's guess.
  return {
    facts: {
      age: candidate.age ?? res.facts.age,
      workPreference: candidate.workPreference ?? res.facts.workPreference,
      expectedSalary: candidate.expectedSalary ?? res.facts.expectedSalary,
      experienceYears: res.facts.experienceYears,
      maxSalesAmount: candidate.maxSalesAmount ?? res.facts.maxSalesAmount,
      experienceText: candidate.experienceText ?? res.facts.experienceText,
    },
    called: true,
    costUsd: spend,
  };
}

export interface ScoreOutcome {
  candidateId: string;
  stars: number;
  filteredOut: boolean;
  /** True when a cached score was reused, meaning no API call was made. */
  cached: boolean;
  costUsd: number;
}

/**
 * Score one candidate against one brief and persist the result.
 *
 * The order is deliberate, and it is where the cost savings live:
 *   1. a cached score for this exact briefHash returns with no calls at all
 *   2. extraction, itself cached on message count
 *   3. hard filters in code, so a rejection here costs nothing
 *   4. only survivors reach the model
 */
export async function scoreForBrief(
  candidateId: string,
  brief: HiringBrief,
  config?: AiConfig,
): Promise<ScoreOutcome> {
  const existing = await db.candidateBriefScore.findUnique({
    where: { candidateId_briefId: { candidateId, briefId: brief.id } },
  });
  if (existing && existing.briefHash === brief.briefHash) {
    return {
      candidateId,
      stars: existing.stars,
      filteredOut: existing.filteredOut,
      cached: true,
      costUsd: 0,
    };
  }

  const cfg = config ?? (await resolveAiConfig());
  let spend = 0;

  const extraction = await ensureExtraction(candidateId, cfg);
  spend += extraction.costUsd;

  const outcome = applyHardFilters(briefFilters(brief), extraction.facts);
  if (!outcome.passed) {
    await db.candidateBriefScore.upsert({
      where: { candidateId_briefId: { candidateId, briefId: brief.id } },
      create: {
        candidateId,
        briefId: brief.id,
        stars: 0,
        filteredOut: true,
        filterReason: outcome.reason,
        briefHash: brief.briefHash,
        costUsd: spend,
      },
      update: {
        stars: 0,
        overallScore: 0,
        coveragePct: 0,
        criteria: [],
        why: "",
        filteredOut: true,
        filterReason: outcome.reason,
        briefHash: brief.briefHash,
        costUsd: spend,
        // Clearing this matters: if a later brief edit lets them back in, they
        // must be notifiable again rather than silently already-notified.
        notifiedAt: null,
      },
    });
    return { candidateId, stars: 0, filteredOut: true, cached: false, costUsd: spend };
  }

  const criteria = briefCriteria(brief);
  const messages = await loadMessages(candidateId);
  const judged = await scoreCandidate(criteria, messages, null, cfg);
  spend += costUsd(judged.model, judged.promptTokens, judged.completionTokens);

  const stars = toStars(criteria, judged.judgement.criteria);

  await db.candidateBriefScore.upsert({
    where: { candidateId_briefId: { candidateId, briefId: brief.id } },
    create: {
      candidateId,
      briefId: brief.id,
      stars: stars.stars,
      overallScore: stars.overallScore,
      coveragePct: stars.coveragePct,
      criteria: judged.judgement.criteria as unknown as Prisma.InputJsonValue,
      why: judged.judgement.why,
      briefHash: brief.briefHash,
      model: judged.model,
      costUsd: spend,
    },
    update: {
      stars: stars.stars,
      overallScore: stars.overallScore,
      coveragePct: stars.coveragePct,
      criteria: judged.judgement.criteria as unknown as Prisma.InputJsonValue,
      why: judged.judgement.why,
      filteredOut: false,
      filterReason: null,
      briefHash: brief.briefHash,
      model: judged.model,
      costUsd: spend,
      notifiedAt: null,
    },
  });

  return { candidateId, stars: stars.stars, filteredOut: false, cached: false, costUsd: spend };
}
