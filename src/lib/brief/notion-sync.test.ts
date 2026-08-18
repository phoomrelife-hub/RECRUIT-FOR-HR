import { describe, it, expect } from "vitest";
import { mapNotionFacts, renderNotionEvidence, firstUrl } from "./notion-sync";
import type { NotionDetail } from "@/lib/notion-detail";

// Modelled on two real pages dumped from the live Notion database.
const page = (info: Partial<NotionDetail["info"]>, qa: NotionDetail["qa"] = []): NotionDetail => ({
  info: {
    name: "", phone: "", email: "", age: null, children: null, address: "",
    position: "", experience: "", maxSales: "", expectedSalary: "",
    equipment: [], lineId: "", ...info,
  },
  allProps: [],
  qa,
});

describe("mapNotionFacts", () => {
  it("maps a real page", () => {
    const f = mapNotionFacts(
      page({
        age: 33,
        address: "กรุงเทพมหานคร",
        experience: "6 ปี เคยขายอุปกรณ์เครื่องครัว ของใช้ในครัว",
        maxSales: "สูงสุดเคยทำได้ 1 ล้านบาท",
        expectedSalary: "30,000+",
      }),
    );
    expect(f.age).toBe(33);
    expect(f.experienceYears).toBe(6);
    expect(f.maxSalesAmount).toBe(1_000_000);
    expect(f.expectedSalary).toBe(30000);
    expect(f.found).toContain("maxSalesAmount");
  });

  // The older form had no ยอดขาย property at all — absence must not throw or
  // silently become 0.
  it("tolerates a page missing half the properties", () => {
    const f = mapNotionFacts(page({ age: 25, expectedSalary: "9,000 บาทต่อเดือน", maxSales: "" }));
    expect(f.expectedSalary).toBe(9000);
    expect(f.maxSalesAmount).toBeNull();
    expect(f.found).not.toContain("maxSalesAmount");
  });

  it("rejects an implausible age instead of trusting it", () => {
    expect(mapNotionFacts(page({ age: 3 })).age).toBeNull();
    expect(mapNotionFacts(page({ age: 250 })).age).toBeNull();
  });

  it("keeps only Q&A pairs that have both halves", () => {
    const f = mapNotionFacts(
      page({}, [
        { question: "ทำไมสนใจตำแหน่งนี้", answer: "เคยทำแอดมินมาก่อน" },
        { question: "คำถามที่ไม่ได้ตอบ", answer: "" },
      ]),
    );
    expect(f.qa).toHaveLength(1);
    expect(f.found).toContain("qa");
  });
});

describe("renderNotionEvidence", () => {
  it("includes experience and Q&A", () => {
    const text = renderNotionEvidence(
      mapNotionFacts(
        page({ experience: "6 ปี ขายเครื่องครัว" }, [
          { question: "ทำไมสนใจ", answer: "อยากทำงานขาย" },
        ]),
      ),
    );
    expect(text).toContain("6 ปี ขายเครื่องครัว");
    expect(text).toContain("อยากทำงานขาย");
  });

  // Contact details are collected by the form and must never reach the model.
  it("never leaks contact details", () => {
    const text = renderNotionEvidence(
      mapNotionFacts(
        page({
          phone: "0967179464",
          email: "jaifon@gmail.com",
          lineId: "nanasulisa",
          experience: "2 ปี",
        }),
      ),
    );
    expect(text).not.toContain("0967179464");
    expect(text).not.toContain("jaifon@gmail.com");
    expect(text).not.toContain("nanasulisa");
  });
});

describe("firstUrl", () => {
  // Real value from the form: a bare host followed by a Thai sentence.
  it("extracts a link from free text and adds a scheme", () => {
    expect(firstUrl("www.tiktok.com/@chx_aem12    ปกติหนูมีช่องหลัก")).toBe(
      "https://www.tiktok.com/@chx_aem12",
    );
  });

  it("leaves a well-formed URL alone", () => {
    expect(firstUrl("https://drive.google.com/file/d/abc123/view")).toBe(
      "https://drive.google.com/file/d/abc123/view",
    );
  });

  it("returns null when there is no link at all", () => {
    expect(firstUrl("ไม่มีค่ะ")).toBeNull();
    expect(firstUrl("")).toBeNull();
    expect(firstUrl(null)).toBeNull();
  });

  it("strips trailing punctuation that is not part of the link", () => {
    expect(firstUrl("ดูที่ behance.net/somchai.")).toBe("https://behance.net/somchai");
  });
});

describe("firstUrl false positives", () => {
  // A generic word.word pattern would turn a filename into a link.
  it("does not treat a filename as a URL", () => {
    expect(firstUrl("แนบไฟล์ resume.pdf มาแล้วค่ะ")).toBeNull();
    expect(firstUrl("portfolio.docx")).toBeNull();
  });
});
