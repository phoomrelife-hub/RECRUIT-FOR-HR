import { computeScore } from "@/lib/qualifier/scoring";
import type { BriefCriterion, CriterionScore } from "./types";

/** Below this, we know too little to award a top rating whatever the score. */
export const THIN_COVERAGE_PCT = 60;
/** Below this, the evidence is barely there at all. */
export const VERY_THIN_COVERAGE_PCT = 40;

export const THIN_COVERAGE_CAP = 3;
export const VERY_THIN_COVERAGE_CAP = 2;

export interface StarResult {
  stars: number;
  overallScore: number;
  coveragePct: number;
  /** Set when a coverage cap held the rating below what the score alone gave. */
  cappedFrom: number | null;
  /**
   * True when NOTHING could be scored.
   *
   * This is a different statement from "1 star". One star means we looked and
   * they are weak; this means we could not tell, and the right response is to
   * ask them a question rather than to rank them last. The first live run
   * collapsed both into 1 star and produced five identical rows.
   */
  noEvidence: boolean;
}

/** Score -> stars, before any coverage cap. */
function starsFromScore(score: number): number {
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  return 1;
}

/**
 * Turn per-criterion scores into a 1-5 star rating.
 *
 * Two rules carry the whole design:
 *
 *  1. Unscored criteria (score === null, "no evidence") are EXCLUDED from the
 *     average rather than counted as zero — that is computeScore's job, and it
 *     is why a candidate with a three-message chat does not rank below one
 *     whose long chat revealed genuine problems.
 *
 *  2. But excluding them means a candidate who answered exactly one question
 *     well would otherwise score 100%. So coverage caps the result. Thin
 *     evidence can never outrank thick evidence, which is the single property
 *     that makes the ranking trustworthy to HR.
 *
 * Stars are derived HERE, in code, and never asked of the model — a model that
 * could name its own star count could route around the cap by claiming 5.
 */
export function toStars(criteria: BriefCriterion[], results: CriterionScore[]): StarResult {
  const { overallScore, coveragePct } = computeScore(
    criteria.map((c, i) => ({ ...c, sortOrder: i })),
    results,
  );

  const raw = starsFromScore(overallScore);

  let cap = 5;
  if (coveragePct < VERY_THIN_COVERAGE_PCT) cap = VERY_THIN_COVERAGE_CAP;
  else if (coveragePct < THIN_COVERAGE_PCT) cap = THIN_COVERAGE_CAP;

  const stars = Math.min(raw, cap);
  return {
    stars,
    overallScore,
    coveragePct,
    cappedFrom: stars < raw ? raw : null,
    // Nothing at all was scoreable. Reported separately so the UI can hold
    // these aside instead of burying them at the bottom of the ranking.
    noEvidence: coveragePct === 0,
  };
}
