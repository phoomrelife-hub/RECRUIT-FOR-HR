/**
 * Shared comparator for the /review HR queue — used by BOTH the server
 * component (`review/page.tsx`) and the client component
 * (`review/review-client.tsx`) so the "strongest first" ordering logic
 * lives in exactly one place. Keep this free of server-only imports
 * (no `@/lib/db`, no `next/*` server APIs) — it must be importable from
 * a client component.
 *
 * Rule that must never break: a candidate with no assessment is NOT a
 * "score 0" — it always sorts after every assessed candidate, regardless
 * of tier or date.
 */

import { parseTier, TIER_CONFIG } from "@/lib/experience-tier";

export const VERDICT_RANK: Record<string, number> = {
  STRONG: 0,
  PROMISING: 1,
  WEAK: 2,
  INSUFFICIENT_DATA: 3,
};

export interface AssessmentSortable {
  overallScore: number;
  verdict: string;
}

export interface QueueSortable {
  assessment: AssessmentSortable | null;
  experienceText?: string | null;
  createdAt: Date | string;
}

/**
 * Base ordering used everywhere in the queue: verdict rank, then
 * descending score within a verdict, then unassessed candidates last.
 */
export function compareByAssessment(a: QueueSortable, b: QueueSortable): number {
  // Candidates with no assessment yet sort last — they are not "score 0".
  if (!a.assessment && !b.assessment) return 0;
  if (!a.assessment) return 1;
  if (!b.assessment) return -1;
  const rank = VERDICT_RANK[a.assessment.verdict] - VERDICT_RANK[b.assessment.verdict];
  if (rank !== 0) return rank;
  return b.assessment.overallScore - a.assessment.overallScore;
}

/**
 * Sales Admin tab ordering: same AI-first base order, with experience
 * tier as the tiebreak within a verdict+score (and createdAt as the
 * final tiebreak, preserving the tab's previous default order).
 */
export function compareForSalesAdminTab(a: QueueSortable, b: QueueSortable): number {
  const byAssessment = compareByAssessment(a, b);
  if (byAssessment !== 0) return byAssessment;

  const ta = TIER_CONFIG[parseTier(a.experienceText)].order;
  const tb = TIER_CONFIG[parseTier(b.experienceText)].order;
  if (ta !== tb) return ta - tb;

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
