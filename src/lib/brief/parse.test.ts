import { describe, it, expect } from "vitest";
import { normaliseParsedBrief } from "./parse";

describe("normaliseParsedBrief", () => {
  it("reads a well-formed response", () => {
    const p = normaliseParsedBrief({
      filters: { minAge: 20, maxAge: 40, maxSalary: 20000, workPreference: "ONSITE", minExperienceYears: 2 },
      criteria: [{ name: "ประสบการณ์ขายเครื่องสำอาง", weight: 4, description: "เคยขายสินค้าความงาม" }],
    });
    expect(p.filters.minAge).toBe(20);
    expect(p.filters.maxAge).toBe(40);
    expect(p.filters.workPreference).toBe("ONSITE");
    expect(p.criteria).toHaveLength(1);
    expect(p.criteria[0].weight).toBe(4);
  });

  it("defaults everything to null on an empty or junk response", () => {
    for (const junk of [null, {}, { filters: null }, "nonsense"]) {
      const p = normaliseParsedBrief(junk);
      expect(p.filters.minAge).toBeNull();
      expect(p.filters.workPreference).toBeNull();
      expect(p.criteria).toEqual([]);
    }
  });

  // A swapped range passes validation but rejects every candidate, and looks
  // fine in the UI while doing it.
  it("repairs a reversed age or salary range", () => {
    const p = normaliseParsedBrief({ filters: { minAge: 40, maxAge: 20, minSalary: 30000, maxSalary: 15000 } });
    expect(p.filters.minAge).toBe(20);
    expect(p.filters.maxAge).toBe(40);
    expect(p.filters.minSalary).toBe(15000);
    expect(p.filters.maxSalary).toBe(30000);
  });

  it("pulls numbers out of strings the model wrapped in units", () => {
    const p = normaliseParsedBrief({ filters: { maxSalary: "20,000 บาท", minExperienceYears: "2 ปี" } });
    expect(p.filters.maxSalary).toBe(20000);
    expect(p.filters.minExperienceYears).toBe(2);
  });

  it("rejects an unrecognised work preference rather than guessing", () => {
    expect(normaliseParsedBrief({ filters: { workPreference: "inhouse" } }).filters.workPreference).toBeNull();
    expect(normaliseParsedBrief({ filters: { workPreference: "onsite" } }).filters.workPreference).toBe("ONSITE");
  });

  // The failure that motivated redact.ts: age reaching the model as prose.
  it("strips a protected attribute the model put in criteria anyway", () => {
    const p = normaliseParsedBrief({
      criteria: [
        { name: "อายุ 20-40 ปี", weight: 5, description: "ต้องอายุ 20-40 ปี" },
        { name: "เพศหญิง", weight: 3, description: "" },
        { name: "ความตั้งใจ", weight: 3, description: "ดูจากการตอบแชท" },
      ],
    });
    expect(p.criteria.map((c) => c.name)).toEqual(["ความตั้งใจ"]);
  });

  it("clamps weights into 1-5 and drops nameless criteria", () => {
    const p = normaliseParsedBrief({
      criteria: [
        { name: "ก", weight: 99, description: "" },
        { name: "  ", weight: 3, description: "" },
        { name: "ข", weight: 0, description: "" },
      ],
    });
    expect(p.criteria).toHaveLength(2);
    expect(p.criteria[0].weight).toBe(5);
    expect(p.criteria[1].weight).toBe(1);
  });
});
