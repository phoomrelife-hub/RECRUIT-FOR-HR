import type { ExtractedFacts, HardFilters } from "./types";
import { meetsEquipment } from "./equipment";
import { meetsProximity, type ProximityTier } from "./proximity";

/**
 * How many of HR's stated requirements a candidate POSITIVELY meets.
 *
 * WHY THIS EXISTS — stars are computed from the soft criteria alone
 * (see stars.ts / toStars). The hard requirements are a gate, not a signal, so
 * a candidate who is 28, asks 16k, has 6 years, lives in สะพานสูง and owns a
 * computer — matching every single thing HR asked for — scores exactly the same
 * as someone who merely failed to contradict any of it. Coverage caps then make
 * it worse: thin soft evidence caps them at 3 stars no matter how perfect the
 * factual match is.
 *
 * The other half of the problem is that `applyHardFilters` passes on UNKNOWN,
 * which is correct (most columns are empty) but means `filteredOut: false`
 * blurs two very different people: one we checked and confirmed, one we know
 * nothing about. This distinguishes them.
 *
 * STRICT by decision: a requirement counts only when we have the data AND it
 * satisfies. An unknown never counts toward the match, because the entire point
 * of this axis is certainty — "80% met, 20% unknown" is a statement about our
 * data, not about the candidate.
 */

export type SpecKey =
  | "age"
  | "salary"
  | "workPreference"
  | "experience"
  | "sales"
  | "equipment"
  | "proximity";

export const SPEC_LABEL: Record<SpecKey, string> = {
  age: "อายุ",
  salary: "เงินเดือน",
  workPreference: "รูปแบบงาน",
  experience: "ประสบการณ์",
  sales: "ยอดขาย",
  equipment: "อุปกรณ์",
  proximity: "ระยะทาง",
};

export interface SpecResult {
  /** Requirements HR actually set. */
  total: number;
  /** Of those, how many the candidate positively satisfies. */
  met: number;
  /** Which ones are confirmed — shown to HR so the number is checkable. */
  metKeys: SpecKey[];
  /** Set but unverifiable for this candidate, because we lack the data. */
  unknownKeys: SpecKey[];
  /** Strict: every stated requirement confirmed. Never true when none are set. */
  full: boolean;
}

export const EMPTY_SPEC: SpecResult = {
  total: 0,
  met: 0,
  metKeys: [],
  unknownKeys: [],
  full: false,
};

/**
 * Evaluate the hard requirements as a SCORE rather than a gate.
 *
 * Only ever called for candidates who already passed `applyHardFilters`, so a
 * requirement is either met or unknown — a contradiction would have removed
 * them from the list entirely.
 */
export function specMatch(
  filters: HardFilters,
  facts: ExtractedFacts,
  proximityTier: ProximityTier,
  /**
   * Passed separately because it is NOT part of HardFilters — it lives on the
   * brief row and run.ts applies it on its own. Reading it off `filters` gave
   * `undefined`, and `undefined !== null` counted proximity as a requirement on
   * every brief, including ones with no requirements at all.
   */
  minProximity: string | null,
): SpecResult {
  const metKeys: SpecKey[] = [];
  const unknownKeys: SpecKey[] = [];

  /** Record one requirement: set at all? and if so, do we know it holds? */
  const check = (key: SpecKey, isSet: boolean, known: boolean) => {
    if (!isSet) return;
    (known ? metKeys : unknownKeys).push(key);
  };

  // Age and salary are ONE requirement each even when both bounds are set —
  // HR thinks of "อายุ 20-40" as a single condition, and counting it twice
  // would silently weight age at double everything else.
  check("age", filters.minAge !== null || filters.maxAge !== null, facts.age !== null);

  check(
    "salary",
    filters.minSalary !== null || filters.maxSalary !== null,
    facts.expectedSalary !== null,
  );

  check("workPreference", filters.workPreference !== null, facts.workPreference !== null);

  check(
    "experience",
    filters.minExperienceYears !== null,
    facts.experienceYears !== null,
  );

  check("sales", filters.minSalesAmount !== null, facts.maxSalesAmount !== null);

  check("equipment", filters.requiredEquipment.length > 0, facts.equipment.length > 0);

  // Proximity is "known" only when the address actually resolved to a tier.
  check("proximity", minProximity !== null, proximityTier !== "unknown");

  const total = metKeys.length + unknownKeys.length;
  return {
    total,
    met: metKeys.length,
    metKeys,
    unknownKeys,
    // `total > 0` matters: with no requirements set, "met everything" would be
    // vacuously true for every candidate and the notify rule would fire on all
    // 757 of them.
    full: total > 0 && unknownKeys.length === 0,
  };
}

/**
 * Should this candidate interrupt HR?
 *
 * Two independent routes, because stars and spec measure different things:
 *   - high stars: the model found real quality in what they wrote
 *   - full spec at a lower star floor: they demonstrably match every stated
 *     requirement, which is the cheap and certain signal
 *
 * A 4-star candidate with a thin form still notifies (decided deliberately):
 * a good judgement on thin evidence is still worth a look.
 */
export function shouldNotifyInstantly(
  stars: number,
  spec: SpecResult,
  notifyStars: number,
  notifyFullSpecStars: number | null,
): { notify: boolean; reason: "stars" | "full_spec" | null } {
  if (stars >= notifyStars) return { notify: true, reason: "stars" };
  if (notifyFullSpecStars !== null && spec.full && stars >= notifyFullSpecStars) {
    return { notify: true, reason: "full_spec" };
  }
  return { notify: false, reason: null };
}

/** Re-exported so callers can express the filter check and the score together. */
export { meetsEquipment, meetsProximity };
