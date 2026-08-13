import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assessmentSchema, buildContentBlocks, buildPrompt, isFileContentRejection, runAssessment,
} from "./assess";
import type { EvidenceBundle, ResolvedRubric } from "./types";

// resolveOpenAiConfig reads Setting rows via this — stub it out so runAssessment
// tests never touch a real database. Falls through to OPENAI_API_KEY (env) below.
vi.mock("@/lib/assistant/config", () => ({
  getSetting: vi.fn().mockResolvedValue(null),
}));

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

  it("emits a file part for a PDF", () => {
    const blocks = buildContentBlocks(
      evidence({ files: [{ label: "Resume", sourceUrl: "u", kind: "pdf", mediaType: "application/pdf", base64: "QQ==" }] }),
      rubric,
    );
    expect(blocks.some((b) => b.type === "file")).toBe(true);
  });

  it("emits an image_url part for a phone photo", () => {
    const blocks = buildContentBlocks(
      evidence({ files: [{ label: "Resume", sourceUrl: "u", kind: "image", mediaType: "image/jpeg", base64: "QQ==" }] }),
      rubric,
    );
    expect(blocks.some((b) => b.type === "image_url")).toBe(true);
  });

  it("never emits a block for an unavailable file", () => {
    const blocks = buildContentBlocks(
      evidence({ files: [{ label: "Resume", sourceUrl: "u", kind: "unavailable", reason: "x" }] }),
      rubric,
    );
    expect(blocks.every((b) => b.type === "text")).toBe(true);
  });

  it("omits all files when omitFiles is set (the file-rejection fallback)", () => {
    const blocks = buildContentBlocks(
      evidence({ files: [{ label: "Resume", sourceUrl: "u", kind: "pdf", mediaType: "application/pdf", base64: "QQ==" }] }),
      rubric,
      { omitFiles: true },
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
  });
});

describe("isFileContentRejection", () => {
  it("recognizes an image_url rejection", () => {
    expect(isFileContentRejection(
      "Invalid content type. image_url is not supported by this model.",
    )).toBe(true);
  });

  it("recognizes a file-part rejection", () => {
    expect(isFileContentRejection(
      "'file' is not a valid content part for this model.",
    )).toBe(true);
  });

  it("does not flag an unrelated API error", () => {
    expect(isFileContentRejection("Rate limit exceeded, please try again later.")).toBe(false);
  });

  it("does not flag a missing-API-key error", () => {
    expect(isFileContentRejection("Incorrect API key provided.")).toBe(false);
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

describe("runAssessment — file-rejection fallback", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.OPENAI_API_KEY = originalKey;
  });

  const okArgs = {
    summary: "s", strengths: "a", concerns: "b", redFlags: "", unverifiedClaims: "c",
    criteria: [{ name: "ประสบการณ์", score: null, reasoning: "ไม่มีไฟล์ให้ดู" }],
    interviewQuestions: [],
  };
  const okResponse = () => ({
    json: () => Promise.resolve({
      choices: [{
        message: {
          tool_calls: [{ function: { name: "submit_assessment", arguments: JSON.stringify(okArgs) } }],
        },
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    }),
  }) as unknown as Response;

  it("retries text-only and marks the file source unavailable when the model rejects the file part", async () => {
    const ev = evidence({
      files: [{ label: "Resume", sourceUrl: "u", kind: "pdf", mediaType: "application/pdf", base64: "QQ==" }],
      sources: [{ label: "Resume", status: "read", detail: "อ่านไฟล์ PDF แล้ว" }],
    });

    const rejectedResponse = {
      json: () => Promise.resolve({
        error: { message: "Invalid content type. 'file' is not supported by this model." },
      }),
    } as unknown as Response;

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(rejectedResponse)
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await runAssessment(ev, rubric);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The retry must not include a file/image content part.
    const secondCallBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    const secondContent = secondCallBody.messages[0].content as { type: string }[];
    expect(secondContent.every((b) => b.type === "text")).toBe(true);

    // sourcesUsed must not lie: the resume was not actually read this time.
    expect(ev.sources.find((s) => s.label === "Resume")?.status).toBe("unavailable");
    expect(result.output.summary).toBe("s");
  });

  it("throws AssessmentFormatError if the model rejects the file part even after the retry", async () => {
    const ev = evidence({
      files: [{ label: "Resume", sourceUrl: "u", kind: "pdf", mediaType: "application/pdf", base64: "QQ==" }],
      sources: [{ label: "Resume", status: "read", detail: "อ่านไฟล์ PDF แล้ว" }],
    });

    const rejectedResponse = {
      json: () => Promise.resolve({
        error: { message: "image_url content is not supported by this model." },
      }),
    } as unknown as Response;

    const fetchMock = vi.fn().mockResolvedValue(rejectedResponse);
    vi.stubGlobal("fetch", fetchMock);

    await expect(runAssessment(ev, rubric)).rejects.toThrow(/AI ตอบกลับในรูปแบบที่ไม่ถูกต้อง/);
    expect(fetchMock).toHaveBeenCalledTimes(2); // no infinite retry loop
  });

  it("does not retry on an unrelated API error (e.g. rate limit)", async () => {
    const ev = evidence({ files: [], sources: [] });

    const errResponse = {
      json: () => Promise.resolve({ error: { message: "Rate limit exceeded, please try again later." } }),
    } as unknown as Response;

    const fetchMock = vi.fn().mockResolvedValue(errResponse);
    vi.stubGlobal("fetch", fetchMock);

    await expect(runAssessment(ev, rubric)).rejects.toThrow(/OpenAI: Rate limit exceeded/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
