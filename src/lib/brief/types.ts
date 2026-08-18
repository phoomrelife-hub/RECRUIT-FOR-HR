import type { WorkPreference } from "@prisma/client";

/**
 * The half of a brief that becomes a SQL predicate.
 *
 * Every field is nullable and null means "HR did not constrain this" — never
 * "the candidate must lack it". Getting that backwards would reject everyone,
 * since most of these columns are empty until the extraction pass fills them.
 */
export interface HardFilters {
  minAge: number | null;
  maxAge: number | null;
  minSalary: number | null;
  maxSalary: number | null;
  workPreference: WorkPreference | null;
  minExperienceYears: number | null;
  minSalesAmount: number | null;
  /** Equipment tokens the candidate must own. Empty = no constraint. */
  requiredEquipment: string[];
}

export const EMPTY_HARD_FILTERS: HardFilters = {
  minAge: null,
  maxAge: null,
  minSalary: null,
  maxSalary: null,
  workPreference: null,
  minExperienceYears: null,
  minSalesAmount: null,
  requiredEquipment: [],
};

/** One thing the model judges, with a weight relative to the others. */
export interface BriefCriterion {
  name: string;
  weight: number;
  description: string;
}

/** A whole brief, split into the two halves that are handled differently. */
export interface ParsedBrief {
  filters: HardFilters;
  criteria: BriefCriterion[];
}

/**
 * What the extraction pass pulls out of a conversation.
 *
 * `null` means the transcript did not say. It must never be coerced to 0 —
 * "expectedSalary: 0" would sail through a `minSalary` filter that a genuine
 * unknown should not.
 */
export interface ExtractedFacts {
  age: number | null;
  workPreference: WorkPreference | null;
  expectedSalary: number | null;
  experienceYears: number | null;
  maxSalesAmount: number | null;
  experienceText: string | null;
  /** What they own, from the Notion form. Empty = never learned. */
  equipment: string[];
}

export const EMPTY_FACTS: ExtractedFacts = {
  age: null,
  workPreference: null,
  expectedSalary: null,
  experienceYears: null,
  maxSalesAmount: null,
  experienceText: null,
  equipment: [],
};

/** Fields a filter can reject on — used to build human-readable reasons. */
export type FactKey = keyof ExtractedFacts;

export interface FilterOutcome {
  passed: boolean;
  /** Thai, shown to HR: "ต้องการ inhouse แต่ผู้สมัครระบุ WFH". */
  reason: string | null;
}

/** One criterion as the model scored it. */
export interface CriterionScore {
  name: string;
  /** null = no evidence. NEVER 0 for missing evidence. */
  score: number | null;
  reasoning: string;
}

export interface Judgement {
  criteria: CriterionScore[];
  why: string;
}
