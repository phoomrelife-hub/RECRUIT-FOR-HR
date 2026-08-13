import { describe, expect, it } from "vitest";
import { applyTemplate, TEMPLATE_PLACEHOLDERS, VISIBLE_CHIP_COUNT } from "./quick-reply-template";

const candidate = {
  fullName: "สมชาย ใจดี",
  nickname: "ชาย",
  positionTitle: "Sales Admin",
};

describe("applyTemplate", () => {
  it("resolves each placeholder", () => {
    expect(applyTemplate("สวัสดีคุณ{{ชื่อ}}", candidate)).toBe("สวัสดีคุณสมชาย ใจดี");
    expect(applyTemplate("สวัสดีคุณ{{ชื่อเล่น}}", candidate)).toBe("สวัสดีคุณชาย");
    expect(applyTemplate("ตำแหน่ง{{ตำแหน่ง}}", candidate)).toBe("ตำแหน่งSales Admin");
  });

  it("resolves several placeholders in one template", () => {
    expect(
      applyTemplate("สวัสดีคุณ{{ชื่อเล่น}} สมัครตำแหน่ง{{ตำแหน่ง}}", candidate)
    ).toBe("สวัสดีคุณชาย สมัครตำแหน่งSales Admin");
  });

  it("repeats a placeholder used more than once", () => {
    expect(applyTemplate("{{ชื่อเล่น}} {{ชื่อเล่น}}", candidate)).toBe("ชาย ชาย");
  });

  // The guard that matters: a candidate over LINE must never receive literal braces.
  it("collapses a null value to empty string, not braces", () => {
    expect(applyTemplate("สวัสดีคุณ{{ชื่อเล่น}}", { ...candidate, nickname: null })).toBe("สวัสดีคุณ");
  });

  it("collapses an undefined value to empty string", () => {
    expect(applyTemplate("สวัสดีคุณ{{ชื่อ}}", {})).toBe("สวัสดีคุณ");
  });

  it("collapses an unknown placeholder to empty string", () => {
    expect(applyTemplate("ยอดขาย {{ยอดขาย}} บาท", candidate)).toBe("ยอดขาย  บาท");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(applyTemplate("สวัสดีคุณ{{ ชื่อเล่น }}", candidate)).toBe("สวัสดีคุณชาย");
  });

  it("passes through content with no placeholders unchanged", () => {
    const plain = "ขอบคุณที่สนใจร่วมงานกับ Relife ครับ";
    expect(applyTemplate(plain, candidate)).toBe(plain);
  });

  it("exposes the three supported placeholders for the editor hint", () => {
    expect(TEMPLATE_PLACEHOLDERS).toEqual(["{{ชื่อ}}", "{{ชื่อเล่น}}", "{{ตำแหน่ง}}"]);
  });

  it("exposes the shared visible-chip count", () => {
    expect(VISIBLE_CHIP_COUNT).toBe(4);
  });
});
