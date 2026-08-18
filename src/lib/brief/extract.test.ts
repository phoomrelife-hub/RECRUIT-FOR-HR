import { describe, it, expect } from "vitest";
import { buildTranscript, normaliseFacts, foundFields } from "./extract";

describe("buildTranscript", () => {
  // A bare "20000" from the candidate is meaningless without the bot's question.
  it("keeps bot turns so short answers have context", () => {
    const t = buildTranscript([
      { senderType: "BOT", content: "คาดหวังเงินเดือนเท่าไหร่คะ" },
      { senderType: "CANDIDATE", content: "20000" },
    ]);
    expect(t).toContain("บอท: คาดหวังเงินเดือนเท่าไหร่คะ");
    expect(t).toContain("ผู้สมัคร: 20000");
  });

  it("drops SYSTEM plumbing and near-empty lines", () => {
    const t = buildTranscript([
      { senderType: "SYSTEM", content: "conversation started with candidate" },
      { senderType: "CANDIDATE", content: "ok" },
      { senderType: "CANDIDATE", content: "สนใจสมัครงานค่ะ" },
    ]);
    expect(t).not.toMatch(/conversation started/);
    expect(t).toContain("สนใจสมัครงานค่ะ");
  });
});

describe("normaliseFacts", () => {
  it("reads a well-formed response", () => {
    const f = normaliseFacts({
      age: 28,
      workPreference: "ONSITE",
      expectedSalary: 18000,
      experienceYears: 3,
      maxSalesAmount: 250000,
      experienceText: "เคยขายเครื่องสำอางออนไลน์ 3 ปี",
    });
    expect(f.age).toBe(28);
    expect(f.expectedSalary).toBe(18000);
    expect(f.maxSalesAmount).toBe(250000);
  });

  it("returns all nulls for junk", () => {
    const f = normaliseFacts({});
    expect(Object.values(f).every((v) => v === null)).toBe(true);
  });

  // A phone number misread as an age would sail past maxAge and silently
  // reject a good candidate.
  it("rejects out-of-range numbers instead of trusting them", () => {
    expect(normaliseFacts({ age: 812345678 }).age).toBeNull();
    expect(normaliseFacts({ age: 3 }).age).toBeNull();
    expect(normaliseFacts({ expectedSalary: 12 }).expectedSalary).toBeNull();
  });

  // The distinction the whole pipeline depends on.
  it("keeps 0 years as a real answer but never invents a 0", () => {
    expect(normaliseFacts({ experienceYears: 0 }).experienceYears).toBe(0);
    expect(normaliseFacts({ experienceYears: null }).experienceYears).toBeNull();
    // 0 is not meaningful for salary, so it is not accepted as one.
    expect(normaliseFacts({ expectedSalary: 0 }).expectedSalary).toBeNull();
  });

  it("parses numbers the model returned as strings with units", () => {
    expect(normaliseFacts({ expectedSalary: "18,000 บาท" }).expectedSalary).toBe(18000);
  });

  it("reports which fields the transcript supported", () => {
    const f = normaliseFacts({ age: 28, expectedSalary: 18000 });
    expect(foundFields(f).sort()).toEqual(["age", "expectedSalary"]);
  });
});
