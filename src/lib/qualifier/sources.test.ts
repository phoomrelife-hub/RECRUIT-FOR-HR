import { describe, expect, it } from "vitest";
import {
  buildSourceRecords, buildTextContext, collectDroppedFileTargets, collectFileTargets,
  computeInputHash,
} from "./sources";
import type { NotionDetail } from "@/lib/notion-detail";
import type { FetchedFile } from "./types";

const emptyInfo = {
  name: "", phone: "", email: "", age: null, children: null, address: "",
  position: "", experience: "", maxSales: "", expectedSalary: "",
  equipment: [] as string[], lineId: "",
};

const detail = (over: Partial<NotionDetail>): NotionDetail => ({
  info: emptyInfo, allProps: [], qa: [], ...over,
});

describe("collectFileTargets", () => {
  it("finds the Resume and Portfolio file properties", () => {
    const d = detail({
      allProps: [
        { name: "Resume", type: "files", value: ["https://drive.google.com/file/d/A/preview"] },
        { name: "Portfolio", type: "files", value: ["https://drive.google.com/file/d/B/preview"] },
      ],
    });
    expect(collectFileTargets(d)).toEqual([
      { label: "Resume", url: "https://drive.google.com/file/d/A/preview" },
      { label: "Portfolio", url: "https://drive.google.com/file/d/B/preview" },
    ]);
  });

  it("ignores 'Portfolio Link' — a URL is not a file the AI can read", () => {
    const d = detail({
      allProps: [{ name: "Portfolio Link", type: "url", value: "https://tiktok.com/@x" }],
    });
    expect(collectFileTargets(d)).toEqual([]);
  });

  it("returns nothing for a Sales Admin applicant with no files", () => {
    expect(collectFileTargets(detail({}))).toEqual([]);
  });

  it("caps at 2 files even if Notion holds more", () => {
    const many = ["A", "B", "C"].map((id) => `https://drive.google.com/file/d/${id}/preview`);
    const d = detail({ allProps: [{ name: "Resume", type: "files", value: many }] });
    expect(collectFileTargets(d).length).toBe(2);
  });

  it("drops Portfolio entirely when Resume alone fills the cap — collectDroppedFileTargets reports it", () => {
    const d = detail({
      allProps: [
        { name: "Resume", type: "files", value: [
          "https://drive.google.com/file/d/A/preview",
          "https://drive.google.com/file/d/B/preview",
        ] },
        { name: "Portfolio", type: "files", value: ["https://drive.google.com/file/d/C/preview"] },
      ],
    });
    expect(collectFileTargets(d)).toEqual([
      { label: "Resume", url: "https://drive.google.com/file/d/A/preview" },
      { label: "Resume", url: "https://drive.google.com/file/d/B/preview" },
    ]);
    expect(collectDroppedFileTargets(d)).toEqual([
      { label: "Portfolio", url: "https://drive.google.com/file/d/C/preview" },
    ]);
  });
});

describe("buildTextContext", () => {
  it("includes the deep Q&A answers", () => {
    const d = detail({ qa: [{ question: "ทำไมอยากทำงานนี้", answer: "ชอบงานขาย" }] });
    const text = buildTextContext(d, "สมชาย");
    expect(text).toContain("ทำไมอยากทำงานนี้");
    expect(text).toContain("ชอบงานขาย");
  });

  it("includes the candidate name", () => {
    expect(buildTextContext(detail({}), "สมชาย")).toContain("สมชาย");
  });

  it("does not inline file URLs (they are sent as document blocks instead)", () => {
    const d = detail({
      allProps: [{ name: "Resume", type: "files", value: ["https://drive.google.com/file/d/A/preview"] }],
    });
    expect(buildTextContext(d, "x")).not.toContain("drive.google.com");
  });
});

describe("buildSourceRecords", () => {
  it("marks a successfully read file as read", () => {
    const targets = [{ label: "Resume", url: "u" }];
    const files: FetchedFile[] = [
      { label: "Resume", sourceUrl: "u", kind: "pdf", mediaType: "application/pdf", base64: "x" },
    ];
    const recs = buildSourceRecords(targets, files, detail({}));
    expect(recs.find((r) => r.label === "Resume")?.status).toBe("read");
  });

  it("marks an unreadable file as unavailable and keeps the reason", () => {
    const targets = [{ label: "Resume", url: "u" }];
    const files: FetchedFile[] = [
      { label: "Resume", sourceUrl: "u", kind: "unavailable", reason: "ไฟล์อ่านไม่ได้" },
    ];
    const recs = buildSourceRecords(targets, files, detail({}));
    const rec = recs.find((r) => r.label === "Resume");
    expect(rec?.status).toBe("unavailable");
    expect(rec?.detail).toContain("ไฟล์อ่านไม่ได้");
  });

  it("records a Portfolio Link as not_provided so the AI cannot pretend to have seen it", () => {
    const d = detail({
      allProps: [{ name: "Portfolio Link", type: "url", value: "https://tiktok.com/@x" }],
    });
    const recs = buildSourceRecords([], [], d);
    const rec = recs.find((r) => r.label === "Portfolio Link");
    expect(rec?.status).toBe("not_provided");
  });

  it("marks a file dropped by the 2-file cap as unavailable, NOT not_provided (it WAS attached)", () => {
    const d = detail({
      allProps: [
        { name: "Resume", type: "files", value: [
          "https://drive.google.com/file/d/A/preview",
          "https://drive.google.com/file/d/B/preview",
        ] },
        { name: "Portfolio", type: "files", value: ["https://drive.google.com/file/d/C/preview"] },
      ],
    });
    const targets = collectFileTargets(d);
    const dropped = collectDroppedFileTargets(d);
    const files: FetchedFile[] = [
      { label: "Resume", sourceUrl: "https://drive.google.com/file/d/A/preview", kind: "pdf" },
      { label: "Resume", sourceUrl: "https://drive.google.com/file/d/B/preview", kind: "pdf" },
    ];
    const recs = buildSourceRecords(targets, files, d, dropped);
    const portfolio = recs.find((r) => r.label === "Portfolio");
    expect(portfolio?.status).toBe("unavailable");
    expect(portfolio?.detail).not.toContain("ไม่ได้แนบไฟล์"); // must not claim it wasn't attached
  });

  it("always records the deep Q&A count", () => {
    const d = detail({ qa: [{ question: "q", answer: "a" }, { question: "q2", answer: "a2" }] });
    const rec = buildSourceRecords([], [], d).find((r) => r.label === "คำถามเชิงลึก");
    expect(rec?.status).toBe("read");
    expect(rec?.detail).toContain("2");
  });
});

describe("computeInputHash", () => {
  it("is stable for identical input", () => {
    expect(computeInputHash("abc", [])).toBe(computeInputHash("abc", []));
  });

  it("changes when the text changes", () => {
    expect(computeInputHash("abc", [])).not.toBe(computeInputHash("abd", []));
  });

  it("changes when a file is added (the staleness case)", () => {
    const f: FetchedFile[] = [{ label: "Resume", sourceUrl: "u", kind: "pdf" }];
    expect(computeInputHash("abc", [])).not.toBe(computeInputHash("abc", f));
  });
});
