import { describe, expect, it } from "vitest";
import { assessmentSchema, buildContentBlocks, buildPrompt } from "./assess";
import type { EvidenceBundle, ResolvedRubric } from "./types";

const rubric: ResolvedRubric = {
  configId: "c1", jobPositionId: "j1", isGlobalFallback: false,
  criteria: [
    { name: "ประสบการณ์", weight: 60, description: "งานขาย", sortOrder: 0 },
    { name: "ผลงาน", weight: 40, description: "portfolio", sortOrder: 1 },
  ],
};

const evidence = (over: Partial<EvidenceBundle> = {}): EvidenceBundle => ({
  candidateId: "cand1", jobPositionId: "j1",
  textContext: "ชื่อ: สมชาย", files: [],
  sources: [{ label: "Portfolio", status: "unavailable", detail: "ไฟล์อ่านไม่ได้" }],
  inputHash: "h", ...over,
});

describe("buildPrompt", () => {
  it("lists every rubric criterion with its weight", () => {
    const p = buildPrompt(evidence(), rubric);
    expect(p).toContain("ประสบการณ์");
    expect(p).toContain("60");
    expect(p).toContain("ผลงาน");
  });

  it("tells the model which evidence was unavailable", () => {
    expect(buildPrompt(evidence(), rubric)).toContain("Portfolio");
  });

  it("forbids scoring a criterion with no evidence", () => {
    const p = buildPrompt(evidence(), rubric);
    expect(p).toMatch(/null/);
  });

  it("includes the candidate text context", () => {
    expect(buildPrompt(evidence(), rubric)).toContain("สมชาย");
  });

  it("says the rubric is a global fallback when it is", () => {
    const p = buildPrompt(evidence(), { ...rubric, isGlobalFallback: true });
    expect(p).toContain("กลาง");
  });
});

describe("buildContentBlocks", () => {
  it("emits a text block only when there are no files", () => {
    const blocks = buildContentBlocks(evidence(), rubric);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
  });

  it("emits a document block for a PDF", () => {
    const blocks = buildContentBlocks(
      evidence({ files: [{ label: "Resume", sourceUrl: "u", kind: "pdf", mediaType: "application/pdf", base64: "QQ==" }] }),
      rubric,
    );
    expect(blocks.some((b) => b.type === "document")).toBe(true);
  });

  it("emits an image block for a phone photo", () => {
    const blocks = buildContentBlocks(
      evidence({ files: [{ label: "Resume", sourceUrl: "u", kind: "image", mediaType: "image/jpeg", base64: "QQ==" }] }),
      rubric,
    );
    expect(blocks.some((b) => b.type === "image")).toBe(true);
  });

  it("never emits a block for an unavailable file", () => {
    const blocks = buildContentBlocks(
      evidence({ files: [{ label: "Resume", sourceUrl: "u", kind: "unavailable", reason: "x" }] }),
      rubric,
    );
    expect(blocks.every((b) => b.type === "text")).toBe(true);
  });
});

describe("assessmentSchema", () => {
  const valid = {
    summary: "s", strengths: "a", concerns: "b", redFlags: "", unverifiedClaims: "c",
    criteria: [{ name: "ประสบการณ์", score: 8, reasoning: "r" }],
    interviewQuestions: [{ axis: "experience", question: "q", why: "w" }],
  };

  it("accepts a well-formed response", () => {
    expect(assessmentSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a null score (evidence unavailable)", () => {
    const r = assessmentSchema.safeParse({
      ...valid, criteria: [{ name: "ผลงาน", score: null, reasoning: "ไม่มีไฟล์" }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects a response missing summary", () => {
    const { summary, ...rest } = valid;
    expect(assessmentSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an unknown interview axis", () => {
    const r = assessmentSchema.safeParse({
      ...valid, interviewQuestions: [{ axis: "vibes", question: "q", why: "w" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a score above 10", () => {
    const r = assessmentSchema.safeParse({
      ...valid, criteria: [{ name: "x", score: 42, reasoning: "r" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a decimal score — the DB column is Int?", () => {
    const r = assessmentSchema.safeParse({
      ...valid, criteria: [{ name: "x", score: 7.5, reasoning: "r" }],
    });
    expect(r.success).toBe(false);
  });

  it("accepts the boundary scores 0 and 10", () => {
    expect(assessmentSchema.safeParse({
      ...valid, criteria: [{ name: "x", score: 0, reasoning: "r" }],
    }).success).toBe(true);
    expect(assessmentSchema.safeParse({
      ...valid, criteria: [{ name: "x", score: 10, reasoning: "r" }],
    }).success).toBe(true);
  });
});
