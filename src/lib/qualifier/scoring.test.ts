import { describe, expect, it } from "vitest";
import { computeScore } from "./scoring";
import type { CriterionResult, RubricCriterion } from "./types";

const c = (name: string, weight: number): RubricCriterion => ({
  name, weight, description: "", sortOrder: 0,
});
const r = (name: string, score: number | null): CriterionResult => ({
  name, score, reasoning: "",
});

describe("computeScore", () => {
  it("scores a fully-covered rubric on a 0-100 scale", () => {
    const out = computeScore([c("a", 50), c("b", 50)], [r("a", 8), r("b", 6)]);
    expect(out.overallScore).toBe(70);   // (8*50 + 6*50) / (10*100) * 100
    expect(out.coveragePct).toBe(100);
    expect(out.verdict).toBe("PROMISING");
  });

  it("renormalises over scored criteria — an unscored one is NOT a zero", () => {
    // Portfolio unreadable. Candidate must not be punished for it.
    const out = computeScore([c("skill", 50), c("portfolio", 50)], [r("skill", 8), r("portfolio", null)]);
    expect(out.overallScore).toBe(80);   // 8/10 over the 50% that was scored
    expect(out.coveragePct).toBe(50);
  });

  it("would have produced 40 if unscored counted as zero (regression guard)", () => {
    const out = computeScore([c("skill", 50), c("portfolio", 50)], [r("skill", 8), r("portfolio", null)]);
    expect(out.overallScore).not.toBe(40);
  });

  it("respects unequal weights", () => {
    const out = computeScore([c("a", 80), c("b", 20)], [r("a", 10), r("b", 0)]);
    expect(out.overallScore).toBe(80);
  });

  it("forces INSUFFICIENT_DATA below 50% coverage regardless of score", () => {
    const out = computeScore([c("a", 40), c("b", 60)], [r("a", 10), r("b", null)]);
    expect(out.overallScore).toBe(100);
    expect(out.coveragePct).toBe(40);
    expect(out.verdict).toBe("INSUFFICIENT_DATA");
  });

  it("keeps a normal verdict at exactly 50% coverage", () => {
    const out = computeScore([c("a", 50), c("b", 50)], [r("a", 10), r("b", null)]);
    expect(out.coveragePct).toBe(50);
    expect(out.verdict).toBe("STRONG");
  });

  it("returns INSUFFICIENT_DATA when nothing was scored at all", () => {
    const out = computeScore([c("a", 50), c("b", 50)], [r("a", null), r("b", null)]);
    expect(out.overallScore).toBe(0);
    expect(out.coveragePct).toBe(0);
    expect(out.verdict).toBe("INSUFFICIENT_DATA");
  });

  it("applies verdict bands: >=75 STRONG, >=50 PROMISING, else WEAK", () => {
    const two = [c("a", 50), c("b", 50)];
    expect(computeScore(two, [r("a", 8), r("b", 7)]).verdict).toBe("STRONG");     // 75
    expect(computeScore(two, [r("a", 5), r("b", 5)]).verdict).toBe("PROMISING");  // 50
    expect(computeScore(two, [r("a", 4), r("b", 5)]).verdict).toBe("WEAK");       // 45
  });

  it("ignores a result whose name is not in the rubric", () => {
    const out = computeScore([c("a", 100)], [r("a", 6), r("ghost", 10)]);
    expect(out.overallScore).toBe(60);
  });

  it("treats a rubric criterion the model omitted as unscored", () => {
    const out = computeScore([c("a", 50), c("b", 50)], [r("a", 8)]);
    expect(out.coveragePct).toBe(50);
    expect(out.overallScore).toBe(80);
  });

  it("clamps an out-of-range model score into 0-10", () => {
    expect(computeScore([c("a", 100)], [r("a", 47)]).overallScore).toBe(100);
    expect(computeScore([c("a", 100)], [r("a", -3)]).overallScore).toBe(0);
  });

  it("handles a zero-weight rubric without dividing by zero", () => {
    const out = computeScore([c("a", 0)], [r("a", 8)]);
    expect(out.coveragePct).toBe(0);
    expect(out.verdict).toBe("INSUFFICIENT_DATA");
    expect(Number.isNaN(out.overallScore)).toBe(false);
  });
});
