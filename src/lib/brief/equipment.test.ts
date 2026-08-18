import { describe, it, expect } from "vitest";
import { normaliseEquipment, normaliseEquipmentList, meetsEquipment } from "./equipment";

describe("normaliseEquipment", () => {
  // The four values that carry ~all the signal across 500 real form pages.
  it("maps the four canonical answers", () => {
    expect(normaliseEquipment("สมาร์ตโฟน")).toBe("phone");
    expect(normaliseEquipment("อินเทอร์เน็ตความเร็วสูง")).toBe("internet");
    expect(normaliseEquipment("คอมพิวเตอร์/โน้ตบุ๊ก")).toBe("computer");
    expect(normaliseEquipment("iPad")).toBe("tablet");
  });

  // Real one-off values people typed into the multi-select.
  it("rescues recognisable variants from the long tail", () => {
    expect(normaliseEquipment("Chrome book")).toBe("computer");
    expect(normaliseEquipment("แท็บเล็ต")).toBe("tablet");
    expect(normaliseEquipment("Tablet")).toBe("tablet");
    expect(normaliseEquipment("ไอแพด")).toBe("tablet");
    expect(normaliseEquipment("มีมือถือ 2 เครื่อง")).toBe("phone");
  });

  // Someone really did type their email address into the equipment field.
  it("drops noise instead of storing it as an option", () => {
    expect(normaliseEquipment("pxh07071900@gmail.com")).toBeNull();
    expect(normaliseEquipment("")).toBeNull();
    expect(normaliseEquipment("Table")).toBeNull();
    expect(
      normaliseEquipment("ไม่มี iPad แต่ว่ามีแท็บเล็ตแอนดรอยด์ค่ะ เพราะว่าเครื่องเก่าพังไปแล้วเมื่อปีที่แล้ว"),
    ).toBeNull();
  });

  // A laptop answer that also names a tablet must not resolve to tablet.
  it("prefers computer when an answer mentions both", () => {
    expect(normaliseEquipment("โน้ตบุ๊ก")).toBe("computer");
  });
});

describe("normaliseEquipmentList", () => {
  it("dedupes and orders consistently", () => {
    expect(
      normaliseEquipmentList(["iPad", "สมาร์ตโฟน", "ไอแพด", "อินเทอร์เน็ตความเร็วสูง"]),
    ).toEqual(["internet", "phone", "tablet"]);
  });

  it("returns an empty list when nothing is recognisable", () => {
    expect(normaliseEquipmentList(["pxh07071900@gmail.com", "Table"])).toEqual([]);
  });
});

describe("meetsEquipment", () => {
  it("passes when nothing is required", () => {
    expect(meetsEquipment([], []).passed).toBe(true);
  });

  // Same rule as every other filter: unknown is a gap in our data, not a fact
  // about the candidate.
  it("never rejects a candidate whose equipment we never learned", () => {
    expect(meetsEquipment(["computer", "internet"], []).passed).toBe(true);
  });

  it("rejects only a known candidate who is genuinely missing something", () => {
    const r = meetsEquipment(["computer", "internet"], ["phone", "internet"]);
    expect(r.passed).toBe(false);
    expect(r.missing).toEqual(["computer"]);
  });

  it("passes when the candidate has everything required and more", () => {
    expect(meetsEquipment(["computer"], ["computer", "phone", "internet"]).passed).toBe(true);
  });
});
