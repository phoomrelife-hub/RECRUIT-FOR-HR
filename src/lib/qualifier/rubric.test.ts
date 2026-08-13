import { describe, expect, it } from "vitest";
import { selectRubric, type RubricRow } from "./rubric";

const crit = (name: string, weight: number) => ({
  name, weight, description: "", sortOrder: 0,
});

const row = (over: Partial<RubricRow>): RubricRow => ({
  id: "c1", jobPositionId: null, isDraft: false, isActive: true,
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
});
