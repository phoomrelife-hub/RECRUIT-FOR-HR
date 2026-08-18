import { describe, it, expect } from "vitest";
import { classifyProximity, meetsProximity, tierRank } from "./proximity";

describe("classifyProximity", () => {
  it("puts the office district and its neighbours at the top", () => {
    for (const a of [
      "76/4 ซอยรามคำแหง 178 เขตมีนบุรี กรุงเทพมหานคร 10510",
      "แขวงมีนบุรี กรุงเทพ",
      "12/5 เขตคลองสามวา กทม",
      "เขตหนองจอก กรุงเทพมหานคร",
      "เขตลาดกระบัง",
      "เขตสะพานสูง กรุงเทพ",
      "เขตคันนายาว กรุงเทพ",
    ]) {
      expect(classifyProximity(a).tier, a).toBe("adjacent");
    }
  });

  it("treats the rest of eastern Bangkok as a workable commute", () => {
    expect(classifyProximity("เขตบางกะปิ กรุงเทพ").tier).toBe("nearby");
    expect(classifyProximity("เขตบึงกุ่ม กทม").tier).toBe("nearby");
    // On the Pink Line, which terminates at Min Buri.
    expect(classifyProximity("เขตหลักสี่ กรุงเทพมหานคร").tier).toBe("nearby");
  });

  // These are REAL addresses pulled from the candidates table.
  it("classifies real applicant addresses from the database", () => {
    const cases: Array<[string, string]> = [
      ["หมู่บ้านขุนแปะ ตำบลบ้านแปะ อำเภอจอมทอง จังหวัดเชียงใหม่", "far"],
      ["จ.ปัตตานี", "far"],
      ["153 ม.6 ต.หนองพระ อ.วังทอง จ.พิษณุโลก 65130", "far"],
      ["29/3 หมู่4 ตำบลหนองหงษ์ อำเภอพานทอง จังหวัดชลบุรี", "far"],
      ["33/9 สะพานดาวเพลส อำเภอเมือง จังหวัดสุรินทร์", "far"],
      ["65 ม.4 ต.ห้วยขมิ้น อ.ด่านช้าง จ.สุพรรณบุรี", "far"],
      ["4/3 หมู่ 3 ตำบลบางแม่นาง อำเภอบางใหญ่ จังหวัดนนทบุรี", "commutable_province"],
      ["กรุงเทพมหานคร", "bangkok"],
    ];
    for (const [addr, tier] of cases) {
      expect(classifyProximity(addr).tier, addr).toBe(tier);
    }
  });

  it("reports what it matched so HR can check the reasoning", () => {
    const r = classifyProximity("บ้านเลขที่ 9 เขตมีนบุรี");
    expect(r.matched).toBe("มีนบุรี");
    expect(r.label).toContain("ใกล้");
  });

  // A district name must win over a province name in the same string, or an
  // ordinary Bangkok address gets exiled to "far".
  it("prefers a Bangkok district over a province mentioned in the same line", () => {
    expect(classifyProximity("เขตลาดกระบัง กรุงเทพ ใกล้ชายแดนสมุทรปราการ").tier).toBe("adjacent");
  });

  it("returns unknown for an empty or unrecognisable address", () => {
    for (const a of [null, undefined, "", "   ", "-"]) {
      expect(classifyProximity(a).tier).toBe("unknown");
    }
  });
});

describe("meetsProximity", () => {
  it("accepts anything at or better than the threshold", () => {
    expect(meetsProximity("adjacent", "nearby")).toBe(true);
    expect(meetsProximity("nearby", "nearby")).toBe(true);
    expect(meetsProximity("far", "nearby")).toBe(false);
    expect(meetsProximity("bangkok", "nearby")).toBe(false);
  });

  // Same rule as every other filter: only 266 of 5,959 addresses exist, so
  // rejecting on a missing one would empty the shortlist.
  it("never rejects a candidate for having no address on file", () => {
    expect(meetsProximity("unknown", "adjacent")).toBe(true);
  });

  it("orders tiers best-first", () => {
    expect(tierRank("adjacent")).toBeLessThan(tierRank("nearby"));
    expect(tierRank("nearby")).toBeLessThan(tierRank("far"));
  });
});

// Every case below was a real "unknown" in the candidates table before the
// alias / postal / landmark layers existed.
describe("addresses that used to be unreadable", () => {
  it("resolves abbreviated and mistyped province names", () => {
    expect(classifyProximity("อยุธยา").tier).toBe("far");
    expect(classifyProximity("433หอพักแจ่มใสน้ำกั่น จ.อุดร").tier).toBe("far");
    expect(classifyProximity("150 ม.2 ท่าดี ลานสกา นครศรี").tier).toBe("far");
    expect(classifyProximity("24 ม.8 ต.สักงาม อ.คลองลาน จะ.กำเเพงเพชร").tier).toBe("far");
    // A typo that would otherwise have hidden a commutable candidate.
    expect(classifyProximity("ปธุมธานี").tier).toBe("commutable_province");
  });

  it("falls back to the postal code when no province is named", () => {
    expect(classifyProximity("144 ต.โค้งไผ่ อ.ขาณุวลักษบุรี 62140").tier).toBe("far");
    expect(classifyProximity("บ้านเลขที่ 1 10510").tier).toBe("adjacent");
    expect(classifyProximity("คอนโดแห่งหนึ่ง 10400").tier).toBe("bangkok");
  });

  it("recognises Bangkok by road or condo name", () => {
    expect(classifyProximity("Icondo green space sukhumvit77").tier).toBe("bangkok");
    expect(classifyProximity("ลุมพินีเพชรเกษม 98").tier).toBe("bangkok");
    expect(classifyProximity("พระราม 8").tier).toBe("bangkok");
    expect(classifyProximity("456 myth resident รัขดา 36 แยก 9-9").tier).toBe("bangkok");
  });

  it("still returns unknown when the address genuinely says nothing", () => {
    expect(classifyProximity("58/199หมู่14").tier).toBe("unknown");
    expect(classifyProximity("380/65 ม.10 ซ.กลมที่ดิน").tier).toBe("unknown");
  });
});
