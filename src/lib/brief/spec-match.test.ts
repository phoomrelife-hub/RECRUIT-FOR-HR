import { describe, it, expect } from "vitest";
import { specMatch, shouldNotifyInstantly, EMPTY_SPEC } from "./spec-match";
import { EMPTY_FACTS, EMPTY_HARD_FILTERS } from "./types";

const F = (o: Partial<typeof EMPTY_HARD_FILTERS>) => ({ ...EMPTY_HARD_FILTERS, ...o });
const C = (o: Partial<typeof EMPTY_FACTS>) => ({ ...EMPTY_FACTS, ...o });

const PROX = "nearby";

const FULL_BRIEF = F({
  minAge: 20,
  maxAge: 40,
  maxSalary: 20000,
  workPreference: "ONSITE",
  minExperienceYears: 2,
  requiredEquipment: ["computer"],
});

describe("specMatch", () => {
  it("counts nothing when HR set no requirements", () => {
    const s = specMatch(EMPTY_HARD_FILTERS, C({ age: 28 }), "adjacent", null);
    expect(s).toEqual(EMPTY_SPEC);
    // Vacuous truth here would fire the notify rule on every candidate.
    expect(s.full).toBe(false);
  });

  // The candidate this whole axis exists for: perfect on paper, thin on prose.
  it("recognises a candidate who positively meets everything", () => {
    const s = specMatch(
      FULL_BRIEF,
      C({
        age: 28,
        expectedSalary: 16000,
        workPreference: "ONSITE",
        experienceYears: 6,
        equipment: ["computer", "internet"],
      }),
      "adjacent",
      PROX,
    );
    expect(s.total).toBe(6);
    expect(s.met).toBe(6);
    expect(s.full).toBe(true);
    expect(s.unknownKeys).toEqual([]);
  });

  // STRICT: an unknown never counts toward the match.
  it("does not credit unknowns", () => {
    const s = specMatch(FULL_BRIEF, C({ age: 28, workPreference: "ONSITE" }), "unknown", PROX);
    expect(s.met).toBe(2);
    expect(s.full).toBe(false);
    expect(s.unknownKeys.sort()).toEqual(["equipment", "experience", "proximity", "salary"]);
  });

  // "อายุ 20-40" is one condition to HR; counting both bounds would weight age
  // at double every other requirement.
  it("treats a two-sided range as a single requirement", () => {
    expect(specMatch(F({ minAge: 20, maxAge: 40 }), C({ age: 30 }), "unknown", null).total).toBe(1);
    expect(specMatch(F({ maxAge: 40 }), C({ age: 30 }), "unknown", null).total).toBe(1);
    expect(
      specMatch(F({ minSalary: 10000, maxSalary: 20000 }), C({ expectedSalary: 15000 }), "unknown", null)
        .total,
    ).toBe(1);
  });

  it("counts proximity only when the address actually resolved", () => {
    expect(specMatch(EMPTY_HARD_FILTERS, EMPTY_FACTS, "adjacent", "nearby").met).toBe(1);
    expect(specMatch(EMPTY_HARD_FILTERS, EMPTY_FACTS, "unknown", "nearby").met).toBe(0);
    // Not set at all -> not a requirement.
    expect(specMatch(EMPTY_HARD_FILTERS, EMPTY_FACTS, "adjacent", null).total).toBe(0);
  });

  it("reports which requirements were confirmed, so the number is checkable", () => {
    const s = specMatch(F({ maxAge: 40, minExperienceYears: 2 }), C({ age: 30 }), "unknown", null);
    expect(s.metKeys).toEqual(["age"]);
    expect(s.unknownKeys).toEqual(["experience"]);
  });
});

describe("shouldNotifyInstantly", () => {
  const full = { ...EMPTY_SPEC, total: 6, met: 6, full: true };
  const partial = { ...EMPTY_SPEC, total: 6, met: 4, full: false };

  it("notifies on high stars alone", () => {
    expect(shouldNotifyInstantly(5, partial, 5, 3)).toEqual({ notify: true, reason: "stars" });
  });

  // The whole point: a 3-star who matches every requirement must not stay silent.
  it("notifies a full-spec candidate below the star threshold", () => {
    expect(shouldNotifyInstantly(3, full, 5, 3)).toEqual({ notify: true, reason: "full_spec" });
  });

  it("stays quiet for the same stars with unknowns", () => {
    expect(shouldNotifyInstantly(3, partial, 5, 3).notify).toBe(false);
  });

  it("respects the full-spec floor", () => {
    expect(shouldNotifyInstantly(2, full, 5, 3).notify).toBe(false);
  });

  it("can have the spec route switched off entirely", () => {
    expect(shouldNotifyInstantly(3, full, 5, null).notify).toBe(false);
  });

  // Decided deliberately: a good judgement on thin evidence is still worth a look.
  it("still notifies a high-star candidate we know little about", () => {
    expect(shouldNotifyInstantly(5, EMPTY_SPEC, 5, 3)).toEqual({ notify: true, reason: "stars" });
  });
});
