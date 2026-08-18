import { describe, it, expect } from "vitest";
import { toStars } from "./stars";
import type { BriefCriterion } from "./types";

const criteria: BriefCriterion[] = [
  { name: "ประสบการณ์ขาย", weight: 3, description: "" },
  { name: "ความตั้งใจ", weight: 2, description: "" },
  { name: "สื่อสารดี", weight: 1, description: "" },
];

describe("toStars", () => {
  it("awards 5 stars for a high score with full coverage", () => {
    const r = toStars(criteria, [
      { name: "ประสบการณ์ขาย", score: 9, reasoning: "" },
      { name: "ความตั้งใจ", score: 9, reasoning: "" },
      { name: "สื่อสารดี", score: 9, reasoning: "" },
    ]);
    expect(r.coveragePct).toBe(100);
    expect(r.stars).toBe(5);
    expect(r.cappedFrom).toBeNull();
  });

  // The property the whole ranking rests on: answering one question perfectly
  // must not beat answering everything well.
  it("caps a perfect-but-thin candidate below a complete one", () => {
    const thin = toStars(criteria, [
      { name: "ประสบการณ์ขาย", score: 10, reasoning: "" },
      { name: "ความตั้งใจ", score: null, reasoning: "ไม่มีข้อมูล" },
      { name: "สื่อสารดี", score: null, reasoning: "ไม่มีข้อมูล" },
    ]);
    const complete = toStars(criteria, [
      { name: "ประสบการณ์ขาย", score: 8, reasoning: "" },
      { name: "ความตั้งใจ", score: 8, reasoning: "" },
      { name: "สื่อสารดี", score: 8, reasoning: "" },
    ]);
    expect(thin.overallScore).toBe(100);
    expect(thin.coveragePct).toBe(50);
    expect(thin.stars).toBe(3);
    expect(thin.cappedFrom).toBe(5);
    expect(complete.stars).toBeGreaterThan(thin.stars);
  });

  it("caps harder when almost nothing was scored", () => {
    const r = toStars(criteria, [
      { name: "สื่อสารดี", score: 10, reasoning: "" },
      { name: "ประสบการณ์ขาย", score: null, reasoning: "" },
      { name: "ความตั้งใจ", score: null, reasoning: "" },
    ]);
    expect(r.coveragePct).toBe(17);
    expect(r.stars).toBe(2);
  });

  // A null must not behave like a zero anywhere in the chain.
  it("does not treat missing evidence as a bad score", () => {
    const missing = toStars(criteria, [
      { name: "ประสบการณ์ขาย", score: 8, reasoning: "" },
      { name: "ความตั้งใจ", score: 8, reasoning: "" },
      { name: "สื่อสารดี", score: null, reasoning: "" },
    ]);
    const bad = toStars(criteria, [
      { name: "ประสบการณ์ขาย", score: 8, reasoning: "" },
      { name: "ความตั้งใจ", score: 8, reasoning: "" },
      { name: "สื่อสารดี", score: 0, reasoning: "" },
    ]);
    expect(missing.overallScore).toBeGreaterThan(bad.overallScore);
  });

  it("gives 1 star rather than 0 when everything scored badly", () => {
    const r = toStars(criteria, [
      { name: "ประสบการณ์ขาย", score: 1, reasoning: "" },
      { name: "ความตั้งใจ", score: 0, reasoning: "" },
      { name: "สื่อสารดี", score: 1, reasoning: "" },
    ]);
    expect(r.stars).toBe(1);
  });
});
