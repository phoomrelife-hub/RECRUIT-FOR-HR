import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { draftRubric, selectRubric, rubricWhere, normaliseWeights, type RubricRow } from "./rubric";

// resolveOpenAiConfig (imported from ./assess) reads Setting rows via this —
// stub it out so draftRubric tests never touch a real database. Falls through
// to OPENAI_API_KEY (env) below.
vi.mock("@/lib/assistant/config", () => ({
  getSetting: vi.fn().mockResolvedValue(null),
}));

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

describe("draftRubric", () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const job = { title: "Sales Admin", description: "ขายของออนไลน์", requiredExperience: "1 ปีขึ้นไป" };

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.OPENAI_API_KEY = originalKey;
  });

  const toolCallResponse = (args: unknown) => ({
    json: () => Promise.resolve({
      choices: [{
        message: {
          tool_calls: [{ function: { name: "submit_rubric", arguments: JSON.stringify(args) } }],
        },
      }],
    }),
  }) as unknown as Response;

  it("parses and normalises a successful tool-call response", async () => {
    const args = {
      criteria: [
        { name: "ประสบการณ์การขาย", weight: 60, description: "เคยขายของออนไลน์มาก่อน" },
        { name: "การสื่อสาร", weight: 40, description: "พูดจาสุภาพ ชัดเจน" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(toolCallResponse(args)));

    const result = await draftRubric(job);

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.name)).toEqual(["ประสบการณ์การขาย", "การสื่อสาร"]);
    expect(result.map((c) => c.weight)).toEqual([60, 40]);
    expect(result.map((c) => c.sortOrder)).toEqual([0, 1]);
  });

  it("normalises weights that don't already sum to 100", async () => {
    const args = {
      criteria: [
        { name: "a", weight: 1, description: "" },
        { name: "b", weight: 3, description: "" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(toolCallResponse(args)));

    const result = await draftRubric(job);
    expect(result.map((c) => c.weight)).toEqual([25, 75]);
  });

  it("throws when the response has no tool_call (malformed output)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ choices: [{ message: {} }] }),
    } as unknown as Response));

    await expect(draftRubric(job)).rejects.toThrow(/AI ตอบกลับผิดรูปแบบ/);
  });

  it("throws a wrapped error when the API returns an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ error: { message: "Rate limit exceeded" } }),
    } as unknown as Response));

    await expect(draftRubric(job)).rejects.toThrow(/OpenAI: Rate limit exceeded/);
  });

  it("never sends temperature or max_tokens (gpt-5.6-luna hard-400s on both)", async () => {
    const args = {
      criteria: [
        { name: "a", weight: 50, description: "" },
        { name: "b", weight: 50, description: "" },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(toolCallResponse(args));
    vi.stubGlobal("fetch", fetchMock);

    await draftRubric(job);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("max_tokens");
  });
});
