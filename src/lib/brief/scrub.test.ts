import { describe, it, expect } from "vitest";
import { scrubContacts } from "./scrub";

describe("scrubContacts", () => {
  it("removes Thai mobile numbers in several formats", () => {
    expect(scrubContacts("เบอร์ 0812345678 ค่ะ")).not.toMatch(/0812345678/);
    expect(scrubContacts("081-234-5678")).not.toMatch(/\d{3}-\d{4}/);
    expect(scrubContacts("+66812345678")).not.toMatch(/66812345678/);
  });

  it("removes emails and LINE ids", () => {
    expect(scrubContacts("อีเมล somchai.j@gmail.com")).toContain("[อีเมล]");
    expect(scrubContacts("line id: somchai123")).toContain("[ไอดีไลน์]");
  });

  // The reason the threshold is 9 digits and not lower: these must survive.
  it("keeps the numbers the pipeline needs to read", () => {
    expect(scrubContacts("อายุ 28 ปี")).toContain("28");
    expect(scrubContacts("ขอเงินเดือน 18000")).toContain("18000");
    expect(scrubContacts("ยอดขายเดือนละ 250000")).toContain("250000");
    expect(scrubContacts("ประสบการณ์ 3 ปี")).toContain("3 ปี");
  });

  it("leaves ordinary Thai text untouched", () => {
    const t = "เคยขายเครื่องสำอางมา 2 ปี ทำงานที่ออฟฟิศได้ค่ะ";
    expect(scrubContacts(t)).toBe(t);
  });
});
