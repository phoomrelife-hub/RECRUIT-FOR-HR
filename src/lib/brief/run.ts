import { db } from "@/lib/db";
import type { HiringBrief, Prisma } from "@prisma/client";
import { resolveAiConfig, type AiConfig } from "./ai";
import { costUsd } from "./cost";
import { extractFacts, foundFields, type TranscriptMessage } from "./extract";
import { applyHardFilters } from "./filter";
import { scoreCandidate } from "./score";
import { toStars } from "./stars";
import type { BriefCriterion, ExtractedFacts, HardFilters } from "./types";
import { renderNotionEvidence, syncFromNotion } from "./notion-sync";
import { classifyProximity, meetsProximity, type ProximityTier } from "./proximity";

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
  /** Form Q&A, rendered for the model. The richest evidence we hold. */
  notionEvidence: string;
  /** Free-text address, for the proximity check. */
  address: string | null;
  /** False when a cached extraction was reused, meaning no API call was made. */
  called: boolean;
  costUsd: number;
}

/**
 * Establish everything we know about a candidate, cheapest source first.
 *
 * ORDER IS THE WHOLE DESIGN:
 *   1. Notion — the application form. Free (no model call), authoritative, and
 *      holds age, address, experience, expected salary and ยอดขายสูงสุด as
 *      considered written answers.
 *   2. Chat — the model, and only for what the form leaves blank. Chiefly
 *      workPreference, which the form never asks and which decides whether
 *      someone can take an onsite job at all.
 *
 * Doing it the other way round is what the first live run did, and it paid a
 * model to guess at fields that were sitting in Notion the whole time.
 *
 * Both halves are cached: Notion on `notionSyncedAt`, chat on message count. A
 * conversation that has not grown cannot hold new facts, so re-reading it is
 * pure spend.
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
        address: true,
      },
    }),
    db.candidateExtraction.findUnique({ where: { candidateId } }),
    db.message.count({ where: { conversation: { candidateId } } }),
  ]);
  if (!candidate) throw new Error(`ไม่พบผู้สมัคร ${candidateId}`);

  // --- 1. Notion, once per candidate. Costs nothing but an HTTP call. ---
  let notionQa = "";
  // Held locally as well as written: `extraction` was read BEFORE the sync, so
  // reading experienceYears back off it would return the stale pre-sync null
  // and silently discard the value we just derived from the form.
  let notionYears: number | null = null;
  if (extraction?.notionSyncedAt) {
    // Already synced: reuse the stored Q&A rather than re-fetching Notion. The
    // scorer needs this on EVERY run, not just the first.
    notionQa = extraction.notionEvidence ?? "";
    notionYears = extraction.experienceYears;
  } else {
    const sync = await syncFromNotion(candidateId).catch(() => null);
    if (sync && !sync.error) {
      notionQa = renderNotionEvidence(sync.facts);
      notionYears = sync.facts.experienceYears;
      // Re-read: syncFromNotion may have just filled columns we selected above.
      const fresh = await db.candidate.findUnique({
        where: { id: candidateId },
        select: {
          age: true,
          workPreference: true,
          expectedSalary: true,
          maxSalesAmount: true,
          experienceText: true,
          address: true,
        },
      });
      if (fresh) Object.assign(candidate, fresh);
      await db.candidateExtraction.upsert({
        where: { candidateId },
        create: {
          candidateId,
          notionSyncedAt: new Date(),
          notionEvidence: notionQa,
          experienceYears: sync.facts.experienceYears,
          foundFields: sync.facts.found,
          messageCount: 0,
        },
        update: {
          notionSyncedAt: new Date(),
          notionEvidence: notionQa,
          ...(sync.facts.experienceYears !== null
            ? { experienceYears: sync.facts.experienceYears }
            : {}),
        },
      });
    }
  }

  if (extraction && extraction.messageCount >= messageCount) {
    return {
      facts: {
        age: candidate.age,
        workPreference: candidate.workPreference,
        expectedSalary: candidate.expectedSalary,
        experienceYears: extraction.experienceYears ?? notionYears,
        maxSalesAmount: candidate.maxSalesAmount,
        experienceText: candidate.experienceText,
      },
      notionEvidence: notionQa,
      address: candidate.address,
      called: false,
      costUsd: 0,
    };
  }

  const messages = await loadMessages(candidateId);
  if (messages.length === 0) {
    return {
      facts: {
        age: candidate.age,
        workPreference: candidate.workPreference,
        expectedSalary: candidate.expectedSalary,
        experienceYears: extraction?.experienceYears ?? notionYears,
        maxSalesAmount: candidate.maxSalesAmount,
        experienceText: candidate.experienceText,
      },
      notionEvidence: notionQa,
      address: candidate.address,
      called: false,
      costUsd: 0,
    };
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
        // Notion's answer wins: it is a considered form response, not a
        // number inferred from small talk. Only fill a gap it left.
        ...(extraction?.experienceYears === null || extraction?.experienceYears === undefined
          ? { experienceYears: res.facts.experienceYears }
          : {}),
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
      // Notion's stated years win; chat only fills the gap.
      experienceYears: notionYears ?? res.facts.experienceYears,
      maxSalesAmount: candidate.maxSalesAmount ?? res.facts.maxSalesAmount,
      experienceText: candidate.experienceText ?? res.facts.experienceText,
    },
    notionEvidence: notionQa,
    address: candidate.address,
    called: true,
    costUsd: spend,
  };
}

export interface ScoreOutcome {
  candidateId: string;
  stars: number;
  proximityTier: ProximityTier;
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
      proximityTier: (existing.proximityTier as ProximityTier) ?? "unknown",
      filteredOut: existing.filteredOut,
      cached: true,
      costUsd: 0,
    };
  }

  const cfg = config ?? (await resolveAiConfig());
  let spend = 0;

  const extraction = await ensureExtraction(candidateId, cfg);
  spend += extraction.costUsd;

  // Proximity is judged from the address, which now comes from the Notion form.
  // It is a REJECTION only when HR explicitly set a threshold; otherwise it is
  // recorded for display and ranking. Every position is onsite in Min Buri, so
  // this is real signal — but with an address on file for only 266 of 5,959
  // candidates, making it a silent default filter would gut the shortlist.
  const proximity = classifyProximity(extraction.address);
  const minProximity = brief.minProximity as ProximityTier | null;

  let outcome = applyHardFilters(briefFilters(brief), extraction.facts);
  if (outcome.passed && minProximity && !meetsProximity(proximity.tier, minProximity)) {
    outcome = {
      passed: false,
      reason: `ที่อยู่ ${proximity.matched ?? "ไม่ระบุ"} (${proximity.label}) ไกลกว่าเกณฑ์ที่ตั้งไว้`,
    };
  }

  if (!outcome.passed) {
    await db.candidateBriefScore.upsert({
      where: { candidateId_briefId: { candidateId, briefId: brief.id } },
      create: {
        candidateId,
        briefId: brief.id,
        stars: 0,
        filteredOut: true,
        filterReason: outcome.reason,
        proximityTier: proximity.tier,
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
        proximityTier: proximity.tier,
        briefHash: brief.briefHash,
        costUsd: spend,
        // Clearing this matters: if a later brief edit lets them back in, they
        // must be notifiable again rather than silently already-notified.
        notifiedAt: null,
      },
    });
    return {
      candidateId,
      stars: 0,
      proximityTier: proximity.tier,
      filteredOut: true,
      cached: false,
      costUsd: spend,
    };
  }

  const criteria = briefCriteria(brief);
  const messages = await loadMessages(candidateId);
  const judged = await scoreCandidate(criteria, messages, null, cfg, extraction.notionEvidence);
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
      proximityTier: proximity.tier,
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
      proximityTier: proximity.tier,
      briefHash: brief.briefHash,
      model: judged.model,
      costUsd: spend,
      notifiedAt: null,
    },
  });

  return {
    candidateId,
    stars: stars.stars,
    proximityTier: proximity.tier,
    filteredOut: false,
    cached: false,
    costUsd: spend,
  };
}
