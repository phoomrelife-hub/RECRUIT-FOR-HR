import { describe, it, expect } from "vitest";
import { applyHardFilters } from "./filter";
import { EMPTY_FACTS, EMPTY_HARD_FILTERS } from "./types";

const filters = (o: Partial<typeof EMPTY_HARD_FILTERS>) => ({ ...EMPTY_HARD_FILTERS, ...o });
const facts = (o: Partial<typeof EMPTY_FACTS>) => ({ ...EMPTY_FACTS, ...o });

describe("applyHardFilters", () => {
  it("passes when HR set no constraints at all", () => {
    expect(applyHardFilters(EMPTY_HARD_FILTERS, facts({ age: 19 })).passed).toBe(true);
  });

  // The single most important behaviour here: 99.7% of rows have no age, and
  // rejecting on unknown would empty the database.
  it("passes every constraint when the fact is unknown", () => {
    const all = filters({
      minAge: 20,
      maxAge: 40,
      maxSalary: 20000,
      workPreference: "ONSITE",
      minExperienceYears: 2,
      minSalesAmount: 100000,
    });
    const r = applyHardFilters(all, EMPTY_FACTS);
    expect(r.passed).toBe(true);
    expect(r.reason).toBeNull();
  });

  it("rejects an age outside the range", () => {
    expect(applyHardFilters(filters({ maxAge: 40 }), facts({ age: 45 })).passed).toBe(false);
    expect(applyHardFilters(filters({ minAge: 20 }), facts({ age: 17 })).passed).toBe(false);
    expect(applyHardFilters(filters({ minAge: 20, maxAge: 40 }), facts({ age: 30 })).passed).toBe(true);
  });

  it("rejects an over-budget ask but keeps a cheaper one", () => {
    expect(applyHardFilters(filters({ maxSalary: 20000 }), facts({ expectedSalary: 35000 })).passed).toBe(false);
    // Asking under budget is a bargain, not a mismatch.
    expect(applyHardFilters(filters({ maxSalary: 20000 }), facts({ expectedSalary: 15000 })).passed).toBe(true);
  });

  // The user's actual scenario: WFH applicants for a now-inhouse-only role.
  it("rejects WFH-only applicants for an onsite role", () => {
    const onsite = filters({ workPreference: "ONSITE" });
    expect(applyHardFilters(onsite, facts({ workPreference: "WFH" })).passed).toBe(false);
    expect(applyHardFilters(onsite, facts({ workPreference: "ONSITE" })).passed).toBe(true);
    // Someone flexible can come in.
    expect(applyHardFilters(onsite, facts({ workPreference: "HYBRID" })).passed).toBe(true);
  });

  it("rejects onsite-only applicants for a remote role", () => {
    const wfh = filters({ workPreference: "WFH" });
    expect(applyHardFilters(wfh, facts({ workPreference: "ONSITE" })).passed).toBe(false);
    expect(applyHardFilters(wfh, facts({ workPreference: "HYBRID" })).passed).toBe(true);
  });

  it("rejects too little experience or too small a sales record", () => {
    expect(applyHardFilters(filters({ minExperienceYears: 2 }), facts({ experienceYears: 1 })).passed).toBe(false);
    expect(applyHardFilters(filters({ minExperienceYears: 2 }), facts({ experienceYears: 3 })).passed).toBe(true);
    expect(applyHardFilters(filters({ minSalesAmount: 100000 }), facts({ maxSalesAmount: 50000 })).passed).toBe(false);
  });

  // A zero is real evidence and must be judged, unlike a null.
  it("treats a genuine zero as a value, not as unknown", () => {
    expect(applyHardFilters(filters({ minExperienceYears: 1 }), facts({ experienceYears: 0 })).passed).toBe(false);
  });

  it("explains the rejection in Thai", () => {
    const r = applyHardFilters(filters({ workPreference: "ONSITE" }), facts({ workPreference: "WFH" }));
    expect(r.reason).toContain("inhouse");
    expect(r.reason).toContain("WFH");
  });
});
