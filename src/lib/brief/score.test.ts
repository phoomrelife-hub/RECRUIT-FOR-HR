import { describe, it, expect } from "vitest";
import { alignCriteria, normaliseJudgement, CriterionDriftError } from "./score";
import type { BriefCriterion } from "./types";

const criteria: BriefCriterion[] = [
  { name: "ประสบการณ์ขาย", weight: 3, description: "" },
  { name: "ความตั้งใจ", weight: 2, description: "" },
];

describe("alignCriteria", () => {
  it("matches exact names", () => {
    const r = alignCriteria(criteria, [
      { name: "ประสบการณ์ขาย", score: 8, reasoning: "ขายครีม 3 ปี" },
      { name: "ความตั้งใจ", score: 6, reasoning: "ตอบเร็ว" },
    ]);
    expect(r.map((c) => c.score)).toEqual([8, 6]);
  });

  // The live ERP bug: the model appends the weight to the name, every lookup
  // misses, and every score silently becomes null — which looks exactly like a
  // candidate with no evidence.
  it("recovers when the model appends the weight to the name", () => {
    const r = alignCriteria(criteria, [
      { name: "ประสบการณ์ขาย (น้ำหนัก 3)", score: 9, reasoning: "" },
      { name: "ความตั้งใจ (น้ำหนัก 2)", score: 7, reasoning: "" },
    ]);
    expect(r.map((c) => c.score)).toEqual([9, 7]);
    expect(r.map((c) => c.name)).toEqual(["ประสบการณ์ขาย", "ความตั้งใจ"]);
  });

  it("throws rather than returning a silently empty result when nothing matches", () => {
    expect(() =>
      alignCriteria(criteria, [
        { name: "something else entirely", score: 9, reasoning: "" },
      ]),
    ).toThrow(CriterionDriftError);
  });

  it("leaves a genuinely missing criterion as null, not 0", () => {
    const r = alignCriteria(criteria, [{ name: "ประสบการณ์ขาย", score: 8, reasoning: "" }]);
    expect(r[1].score).toBeNull();
  });

  it("preserves an explicit null and an explicit 0 as different things", () => {
    const r = alignCriteria(criteria, [
      { name: "ประสบการณ์ขาย", score: null, reasoning: "ไม่ได้พูดถึง" },
      { name: "ความตั้งใจ", score: 0, reasoning: "ตอบห้วน ไม่สนใจ" },
    ]);
    expect(r[0].score).toBeNull();
    expect(r[1].score).toBe(0);
  });

  it("clamps out-of-range scores", () => {
    const r = alignCriteria(criteria, [
      { name: "ประสบการณ์ขาย", score: 99, reasoning: "" },
      { name: "ความตั้งใจ", score: -5, reasoning: "" },
    ]);
    expect(r.map((c) => c.score)).toEqual([10, 0]);
  });
});

describe("normaliseJudgement", () => {
  it("handles a missing criteria array without throwing when nothing is expected", () => {
    expect(normaliseJudgement({}, []).criteria).toEqual([]);
  });

  it("keeps the summary text", () => {
    const j = normaliseJudgement(
      { criteria: [{ name: "ประสบการณ์ขาย", score: 8, reasoning: "" }], why: "น่าสนใจ" },
      criteria,
    );
    expect(j.why).toBe("น่าสนใจ");
  });
});
