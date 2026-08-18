import { describe, it, expect } from "vitest";
import { parseThaiAmount, parseExperienceYears } from "./thai-number";

describe("parseThaiAmount", () => {
  // Every string here is a real answer pulled from the Notion form.
  it("parses real answers from the form", () => {
    expect(parseThaiAmount("9,000 บาทต่อเดือน")).toBe(9000);
    expect(parseThaiAmount("30,000+")).toBe(30000);
    expect(parseThaiAmount("สูงสุดเคยทำได้ 1 ล้านบาท")).toBe(1_000_000);
  });

  // The bug this file exists to prevent: parseInt("1 ล้านบาท") === 1.
  it("applies Thai scale words", () => {
    expect(parseThaiAmount("1 ล้าน")).toBe(1_000_000);
    expect(parseThaiAmount("5 แสน")).toBe(500_000);
    expect(parseThaiAmount("2 หมื่น")).toBe(20_000);
    expect(parseThaiAmount("ประมาณ 3 ล้านบาท")).toBe(3_000_000);
    expect(parseThaiAmount("ล้านกว่าบาท")).toBe(1_000_000);
  });

  it("takes the lowest number of a range", () => {
    expect(parseThaiAmount("15000-18000")).toBe(15000);
    expect(parseThaiAmount("20,000 - 25,000 บาท")).toBe(20000);
  });

  it("returns null for a non-answer rather than 0", () => {
    for (const s of ["แล้วแต่บริษัท", "ตามโครงสร้างบริษัท", "ไม่ระบุ", "ไม่เคยขาย", "-", "", null]) {
      expect(parseThaiAmount(s), String(s)).toBeNull();
    }
  });

  it("ignores figures too small or too large to be money", () => {
    expect(parseThaiAmount("2 ปี")).toBeNull();
    expect(parseThaiAmount("ขายได้ 50 ชิ้น")).toBeNull();
  });
});

describe("parseExperienceYears", () => {
  it("parses real prose answers from the form", () => {
    expect(parseExperienceYears("มีประสบการขาย 2 ปี สินค้าเป็นผัก-ผลไม้ฤดูกาล")).toBe(2);
    expect(
      parseExperienceYears("6 ปี เคยขายอุปกรณ์เครื่องครัว ของใช้ในครัว ขายระบบประหยัดพลังงาน"),
    ).toBe(6);
  });

  it("treats 'no experience' as a real zero, not as unknown", () => {
    expect(parseExperienceYears("ไม่มีประสบการณ์ค่ะ")).toBe(0);
    expect(parseExperienceYears("เพิ่งจบใหม่")).toBe(0);
  });

  // "8 เดือน" must not be read as 8 years and sail past a 2-year filter.
  it("converts months to years", () => {
    expect(parseExperienceYears("8 เดือน")).toBe(1);
    expect(parseExperienceYears("3 เดือน")).toBe(0);
  });

  it("handles half years and plus signs", () => {
    expect(parseExperienceYears("2 ปีครึ่ง")).toBe(3);
    expect(parseExperienceYears("5+ ปี")).toBe(5);
  });

  it("returns null when no duration is stated", () => {
    expect(parseExperienceYears("เคยขายเครื่องสำอาง")).toBeNull();
    expect(parseExperienceYears("")).toBeNull();
  });
});

// Every string below is a real experienceText value from the candidates table.
describe("parseExperienceYears on real form answers", () => {
  it("handles missing spaces around ปี", () => {
    expect(parseExperienceYears("1ปี เสื้อผ้าออนไลน์")).toBe(1);
    expect(parseExperienceYears("ขายสินค้าทั่วไป เสื้อผ้า มีประสบการณ์ด้านแอดมิน3ปี")).toBe(3);
  });

  // Taking the high end would let someone past a ">= 2 ปี" filter they do not clear.
  it("takes the low end of a range", () => {
    expect(parseExperienceYears("1-2ปี เป็นPC เชียร์ขายสินค้า เครื่องสำอางค์")).toBe(1);
  });

  it("reads a bare 'ไม่เคย' as zero, not as unknown", () => {
    expect(parseExperienceYears("ไม่เคย")).toBe(0);
  });
});
