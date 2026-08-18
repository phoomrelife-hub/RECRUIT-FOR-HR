/**
 * Live smoke test for the brief pipeline. Hits the real model; writes nothing.
 *
 *   npx vitest run --config vitest.smoke.config.ts
 *
 * Not named *.test.ts on purpose — it costs money and needs a key, so it must
 * never run as part of the normal suite.
 */
import { describe, it, expect } from "vitest";
import { parseBrief } from "./parse";
import { extractFacts } from "./extract";
import { scoreCandidate } from "./score";
import { applyHardFilters } from "./filter";
import { toStars } from "./stars";
import type { AiConfig } from "./ai";
import type { TranscriptMessage } from "./extract";

const config: AiConfig = {
  provider: "gemini",
  model: process.env.SMOKE_MODEL ?? "gemini-3.7-flash",
  apiKey: process.env.GEMINI_API_KEY ?? "",
};

const BRIEF = `รับ Sales Admin เข้าออฟฟิศเท่านั้น ตอนนี้ปิดรับ WFH แล้ว
อายุ 20-40 ปี ประสบการณ์ขาย 2 ปีขึ้นไป งบเงินเดือนไม่เกิน 20,000
อยากได้คนที่เคยขายสินค้าสุขภาพหรือความงาม และดูตั้งใจจริง`;

const GOOD: TranscriptMessage[] = [
  { senderType: "BOT", content: "สนใจตำแหน่งไหนคะ" },
  { senderType: "CANDIDATE", content: "สนใจ Sales Admin ค่ะ เข้าออฟฟิศได้" },
  { senderType: "BOT", content: "อายุเท่าไหร่ และมีประสบการณ์ขายไหมคะ" },
  {
    senderType: "CANDIDATE",
    content: "อายุ 28 ค่ะ เคยขายอาหารเสริมออนไลน์มา 3 ปี ยอดขายเดือนละประมาณ 250000",
  },
  { senderType: "BOT", content: "คาดหวังเงินเดือนเท่าไหร่คะ" },
  { senderType: "CANDIDATE", content: "ขอ 18000 ค่ะ เบอร์ 0812345678 พร้อมเริ่มงานเลยค่ะ" },
];

const WFH: TranscriptMessage[] = [
  { senderType: "BOT", content: "สนใจตำแหน่งไหนคะ" },
  {
    senderType: "CANDIDATE",
    content: "สนใจ Sales Admin แต่ขอทำที่บ้านอย่างเดียวนะคะ เข้าออฟฟิศไม่ได้เลย",
  },
  { senderType: "BOT", content: "อายุเท่าไหร่คะ" },
  { senderType: "CANDIDATE", content: "32 ค่ะ เคยขายเสื้อผ้า 1 ปี" },
];

const THIN: TranscriptMessage[] = [
  { senderType: "BOT", content: "สนใจตำแหน่งไหนคะ" },
  { senderType: "CANDIDATE", content: "สนใจค่ะ" },
];

describe("live brief pipeline", () => {
  it("parses a Thai brief into filters and criteria", async () => {
    const { parsed } = await parseBrief(BRIEF, "Sales Admin", config);
    console.log("filters :", parsed.filters);
    console.log("criteria:", parsed.criteria.map((c) => `${c.name}(${c.weight})`).join(", "));

    expect(parsed.filters.maxAge).toBe(40);
    expect(parsed.filters.minAge).toBe(20);
    expect(parsed.filters.workPreference).toBe("ONSITE");
    expect(parsed.filters.maxSalary).toBe(20000);
    expect(parsed.criteria.length).toBeGreaterThan(0);
    // Age became a column, so it must NOT also be a thing the model judges.
    expect(parsed.criteria.some((c) => /อายุ|age/i.test(c.name))).toBe(false);
  }, 60_000);

  it("extracts facts from a transcript", async () => {
    const { facts } = await extractFacts(GOOD, config);
    console.log("facts:", facts);
    expect(facts.age).toBe(28);
    expect(facts.workPreference).toBe("ONSITE");
    expect(facts.expectedSalary).toBe(18000);
    expect(facts.experienceYears).toBe(3);
    expect(facts.maxSalesAmount).toBe(250000);
  }, 60_000);

  it("rejects a WFH-only candidate without calling the model", async () => {
    const { parsed } = await parseBrief(BRIEF, "Sales Admin", config);
    const { facts } = await extractFacts(WFH, config);
    console.log("wfh facts:", facts);
    const gate = applyHardFilters(parsed.filters, facts);
    console.log("gate:", gate);
    expect(gate.passed).toBe(false);
    expect(gate.reason).toContain("WFH");
  }, 90_000);

  it("scores a strong candidate above a near-silent one", async () => {
    const { parsed } = await parseBrief(BRIEF, "Sales Admin", config);

    const good = await scoreCandidate(parsed.criteria, GOOD, "Sales Admin", config);
    const goodStars = toStars(parsed.criteria, good.judgement.criteria);
    console.log("GOOD:", goodStars, good.judgement.why);

    const thin = await scoreCandidate(parsed.criteria, THIN, "Sales Admin", config);
    const thinStars = toStars(parsed.criteria, thin.judgement.criteria);
    console.log("THIN:", thinStars, thin.judgement.why);

    expect(goodStars.stars).toBeGreaterThan(thinStars.stars);
    // The near-silent candidate must be capped by coverage, not scored highly.
    expect(thinStars.coveragePct).toBeLessThan(60);
    // And the model must not have invented reasons about age.
    expect(/อายุ/.test(good.judgement.why)).toBe(false);
  }, 120_000);
});
