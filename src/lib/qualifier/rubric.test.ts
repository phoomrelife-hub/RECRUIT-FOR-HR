import { describe, expect, it } from "vitest";
import { selectRubric, rubricWhere, normaliseWeights, type RubricRow } from "./rubric";

const crit = (name: string, weight: number) => ({
  name, weight, description: "", sortOrder: 0,
});

const row = (over: Partial<RubricRow>): RubricRow => ({
  id: "c1", jobPositionId: null, isDraft: false, isActive: true, approvedAt: null,
  categories: [crit("experience", 50), crit("communication", 50)],
  ...over,
});

describe("selectRubric", () => {
  it("prefers the approved rubric for the candidate's position", () => {
    const configs = [
      row({ id: "global", jobPositionId: null }),
      row({ id: "pos", jobPositionId: "job1" }),
    ];
    const r = selectRubric(configs, "job1");
    expect(r?.configId).toBe("pos");
    expect(r?.isGlobalFallback).toBe(false);
  });

  it("falls back to the global rubric and flags the fallback", () => {
    const configs = [row({ id: "global", jobPositionId: null })];
    const r = selectRubric(configs, "job1");
    expect(r?.configId).toBe("global");
    expect(r?.isGlobalFallback).toBe(true);
  });

  it("NEVER selects a draft rubric, even for an exact position match", () => {
    const configs = [
      row({ id: "global", jobPositionId: null }),
      row({ id: "draft-pos", jobPositionId: "job1", isDraft: true }),
    ];
    expect(selectRubric(configs, "job1")?.configId).toBe("global");
  });

  it("ignores inactive rubrics", () => {
    const configs = [
      row({ id: "global", jobPositionId: null }),
      row({ id: "pos", jobPositionId: "job1", isActive: false }),
    ];
    expect(selectRubric(configs, "job1")?.configId).toBe("global");
  });

  it("ignores a rubric with no criteria", () => {
    const configs = [
      row({ id: "global", jobPositionId: null }),
      row({ id: "empty", jobPositionId: "job1", categories: [] }),
    ];
    expect(selectRubric(configs, "job1")?.configId).toBe("global");
  });

  it("returns null when nothing usable exists", () => {
    expect(selectRubric([row({ id: "d", isDraft: true })], "job1")).toBeNull();
  });

  it("uses the global rubric when the candidate has no position", () => {
    const configs = [row({ id: "global", jobPositionId: null })];
    const r = selectRubric(configs, null);
    expect(r?.configId).toBe("global");
    expect(r?.isGlobalFallback).toBe(false); // no position to fall back FROM
  });

  it("is deterministic among duplicate global rubrics — picks the most recently approved", () => {
    // Postgres treats NULLs as distinct, so multiple jobPositionId:null rows can
    // coexist even with the unique index. Without a tie-break, `pool.find(...)`
    // picks whichever the array happens to list first.
    const configs = [
      row({ id: "older", jobPositionId: null, approvedAt: new Date("2026-01-01") }),
      row({ id: "newer", jobPositionId: null, approvedAt: new Date("2026-06-01") }),
    ];
    expect(selectRubric(configs, null)?.configId).toBe("newer");
    // Order-independent: reversing the input array must not change the pick.
    expect(selectRubric([...configs].reverse(), null)?.configId).toBe("newer");
  });

  it("is deterministic when approvedAt is tied — falls back to id order", () => {
    const configs = [
      row({ id: "b", jobPositionId: null, approvedAt: null }),
      row({ id: "a", jobPositionId: null, approvedAt: null }),
    ];
    expect(selectRubric(configs, null)?.configId).toBe("a");
  });
});

describe("rubricWhere (regression test for Prisma query construction)", () => {
  it("builds an OR clause when jobPositionId is provided", () => {
    const where = rubricWhere("job1");
    expect(where).toEqual({
      OR: [{ jobPositionId: null }, { jobPositionId: "job1" }],
    });
  });

  it("builds a simple filter for global rubrics when jobPositionId is null", () => {
    const where = rubricWhere(null);
    expect(where).toEqual({ jobPositionId: null });
  });

  it("does NOT include undefined values that would cause Prisma to ignore the clause", () => {
    const where = rubricWhere(null);
    // Verify no undefined values that Prisma would drop, causing match-all behavior.
    expect(Object.values(where)).not.toContain(undefined);
  });
});

describe("normaliseWeights", () => {
  it("scales weights to sum to 100", () => {
    const out = normaliseWeights([
      { name: "a", weight: 1, description: "", sortOrder: 0 },
      { name: "b", weight: 3, description: "", sortOrder: 1 },
    ]);
    expect(out.map((c) => c.weight)).toEqual([25, 75]);
  });

  it("leaves already-normalised weights alone", () => {
    const out = normaliseWeights([
      { name: "a", weight: 60, description: "", sortOrder: 0 },
      { name: "b", weight: 40, description: "", sortOrder: 1 },
    ]);
    expect(out.map((c) => c.weight)).toEqual([60, 40]);
  });

  it("distributes evenly when every weight is zero", () => {
    const out = normaliseWeights([
      { name: "a", weight: 0, description: "", sortOrder: 0 },
      { name: "b", weight: 0, description: "", sortOrder: 1 },
    ]);
    expect(out.map((c) => c.weight)).toEqual([50, 50]);
  });

  it("returns an empty array unchanged", () => {
    expect(normaliseWeights([])).toEqual([]);
  });

  it("rounds decimal weights even when the total is already exactly 100", () => {
    // Regression: the early-return path used to skip rounding entirely, so a
    // caller-supplied 50.5/49.5 (total 100) reached Prisma's Int column unrounded.
    const out = normaliseWeights([
      { name: "a", weight: 50.5, description: "", sortOrder: 0 },
      { name: "b", weight: 49.5, description: "", sortOrder: 1 },
    ]);
    expect(out.map((c) => c.weight)).toEqual([51, 50]);
    expect(out.every((c) => Number.isInteger(c.weight))).toBe(true);
  });
});
