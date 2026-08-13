import type { CriterionResult, RubricCriterion, Verdict } from "./types";

export const MIN_COVERAGE_PCT = 50;

const clamp = (n: number) => Math.max(0, Math.min(10, n));

/**
 * Weighted 0-100 score over ONLY the criteria that were actually scored.
 * Unscored criteria (score === null, i.e. evidence unavailable) are excluded and
 * the remaining weights are renormalised — they must never act as a zero, or a
 * candidate whose portfolio failed to download would rank below one whose
 * portfolio was read and was mediocre.
 */
export function computeScore(
  criteria: RubricCriterion[],
  results: CriterionResult[],
): { overallScore: number; coveragePct: number; verdict: Verdict } {
  const byName = new Map(results.map((r) => [r.name, r]));

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  let scoredWeight = 0;
  let weightedPoints = 0;

  for (const c of criteria) {
    const result = byName.get(c.name);
    if (!result || result.score === null || result.score === undefined) continue;
    scoredWeight += c.weight;
    weightedPoints += clamp(result.score) * c.weight;
  }

  const coveragePct = totalWeight > 0 ? Math.round((scoredWeight / totalWeight) * 100) : 0;
  const overallScore = scoredWeight > 0
    ? Math.round((weightedPoints / (scoredWeight * 10)) * 100)
    : 0;

  let verdict: Verdict;
  if (coveragePct < MIN_COVERAGE_PCT) verdict = "INSUFFICIENT_DATA";
  else if (overallScore >= 75) verdict = "STRONG";
  else if (overallScore >= 50) verdict = "PROMISING";
  else verdict = "WEAK";

  return { overallScore, coveragePct, verdict };
}
