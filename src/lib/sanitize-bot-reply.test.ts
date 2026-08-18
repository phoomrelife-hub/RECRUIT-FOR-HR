import { describe, expect, it } from "vitest";
import { isInternalLeak, sanitizeBotReply } from "./sanitize-bot-reply";

describe("sanitizeBotReply", () => {
  it("strips knowledge-base file references", () => {
    expect(sanitizeBotReply("อายุ 20 ขึ้นไปค่ะ (Source: SOUL.md#กฎเรื่องอายุ)")).toBe(
      "อายุ 20 ขึ้นไปค่ะ"
    );
    // note: removal leaves the surrounding spaces as-is (pre-existing behaviour)
    expect(sanitizeBotReply("ตามที่ระบุใน POSITIONS.md ค่ะ")).toBe("ตามที่ระบุใน  ค่ะ");
  });

  it("strips lines where the bot narrates its own session bookkeeping", () => {
    // the exact leak reported by a candidate
    expect(sanitizeBotReply("ตรวจสอบ session state ก่อนค่ะ")).toBe("");
    expect(
      sanitizeBotReply("เริ่มต้นด้วยการเช็ค session state ของผู้ใช้ก่อนครับ")
    ).toBe("");
    expect(sanitizeBotReply("หลินจะอัปเดต session_manager ให้ค่ะ")).toBe("");
    expect(sanitizeBotReply("sender_id นี้ยังไม่มีข้อมูลค่ะ")).toBe("");
  });

  it("keeps the real reply when narration is only one line of it", () => {
    const mixed = "ตรวจสอบ session state ก่อนค่ะ\nสวัสดีค่ะ สนใจตำแหน่งไหนคะ?";
    expect(sanitizeBotReply(mixed)).toBe("สวัสดีค่ะ สนใจตำแหน่งไหนคะ?");
  });

  it("leaves ordinary replies untouched", () => {
    const real = [
      "สวัสดีค่ะ! 🎉 น้องหลินนะคะ ยินดีมากเลยที่สนใจสมัครงานกับเรา 😊",
      "บริษัท รีไลฟ์ โซลูชั่นส์ จำกัด อยู่ที่ 76/4 อาคารแพลตินัมเพลส ซอยรามคำแหง 178 ค่ะ",
      "ขออภัยนะคะ ตอนนี้เราไม่มีตำแหน่ง หัวหน้าบัญชี เปิดรับค่ะ 🙏",
      // near-misses that must survive — ordinary Thai that starts the same way
      "ตรวจสอบข้อมูลเรียบร้อยแล้วนะคะ เดี๋ยวทีม HR ติดต่อกลับค่ะ",
      "เช็คตารางสัมภาษณ์ให้แล้วนะคะ วันจันทร์ 10 โมงค่ะ",
    ];
    for (const t of real) expect(sanitizeBotReply(t)).toBe(t);
  });
});

describe("isInternalLeak", () => {
  it("flags a reply that is pure narration", () => {
    expect(isInternalLeak("ตรวจสอบ session state ก่อนค่ะ")).toBe(true);
  });

  it("does not flag real replies or empty input", () => {
    expect(isInternalLeak("สวัสดีค่ะ สนใจตำแหน่งไหนคะ?")).toBe(false);
    expect(isInternalLeak("ตรวจสอบข้อมูลเรียบร้อยแล้วนะคะ")).toBe(false);
    expect(isInternalLeak("   ")).toBe(false);
  });
});
