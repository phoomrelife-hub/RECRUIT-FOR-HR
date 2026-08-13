import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyBytes, countPdfPages, extractDriveFileId, fetchCandidateFile, toDownloadUrl } from "./files";

const bytes = (...n: number[]) => new Uint8Array(n);
const ascii = (s: string) => new TextEncoder().encode(s);

describe("extractDriveFileId", () => {
  it("pulls the id out of the /preview URL the Apps Script writes", () => {
    expect(extractDriveFileId("https://drive.google.com/file/d/1AbC_dEf-123/preview"))
      .toBe("1AbC_dEf-123");
  });

  it("handles the /view variant", () => {
    expect(extractDriveFileId("https://drive.google.com/file/d/1AbC/view?usp=sharing"))
      .toBe("1AbC");
  });

  it("handles the open?id= variant", () => {
    expect(extractDriveFileId("https://drive.google.com/open?id=1AbC")).toBe("1AbC");
  });

  it("returns null for a non-Drive URL (e.g. a TikTok portfolio link)", () => {
    expect(extractDriveFileId("https://www.tiktok.com/@someone")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(extractDriveFileId("")).toBeNull();
  });
});

describe("toDownloadUrl", () => {
  it("rewrites a preview URL to a direct download URL", () => {
    expect(toDownloadUrl("https://drive.google.com/file/d/1AbC/preview"))
      .toBe("https://drive.google.com/uc?export=download&id=1AbC");
  });

  it("returns null when the URL is not a Drive file", () => {
    expect(toDownloadUrl("https://youtube.com/watch?v=x")).toBeNull();
  });
});

describe("classifyBytes", () => {
  it("recognises a PDF", () => {
    expect(classifyBytes(ascii("%PDF-1.7\n..."))).toEqual({
      kind: "pdf", mediaType: "application/pdf",
    });
  });

  it("recognises a JPEG (the phone-photo-of-a-resume case)", () => {
    expect(classifyBytes(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toEqual({
      kind: "image", mediaType: "image/jpeg",
    });
  });

  it("recognises a PNG", () => {
    expect(classifyBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toEqual({
      kind: "image", mediaType: "image/png",
    });
  });

  it("rejects a Google sign-in page served as HTTP 200 text/html", () => {
    expect(classifyBytes(ascii("<!DOCTYPE html><html><head><title>Sign in"))).toBeNull();
  });

  it("rejects a virus-scan interstitial", () => {
    expect(classifyBytes(ascii("<html><body>Google Drive can't scan this file"))).toBeNull();
  });

  it("rejects a DOCX (a zip) — out of scope for v1", () => {
    expect(classifyBytes(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull();
  });

  it("rejects bytes too short to identify", () => {
    expect(classifyBytes(bytes(0x25))).toBeNull();
  });
});

describe("countPdfPages", () => {
  it("counts page objects in a minimal PDF", () => {
    const pdf = ascii("%PDF-1.4 /Type /Page x /Type /Page y /Type /Pages z");
    expect(countPdfPages(pdf)).toBe(2); // /Type /Pages is the tree node, not a page
  });

  it("tolerates the no-space form", () => {
    expect(countPdfPages(ascii("%PDF-1.4 /Type/Page a /Type/Page b"))).toBe(2);
  });

  it("returns 0 when it cannot tell (caller must not reject on 0)", () => {
    expect(countPdfPages(ascii("%PDF-1.4 compressed-xref-stream"))).toBe(0);
  });
});

describe("fetchCandidateFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never throws — a body-read failure after a 200 response yields 'unavailable'", async () => {
    // res.ok is true (download started fine) but the body stream breaks mid-read
    // (connection reset, aborted stream, decompression failure, etc.)
    const fakeResponse = {
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.reject(new Error("stream reset")),
    } as unknown as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse));

    const result = await fetchCandidateFile(
      "Resume",
      "https://drive.google.com/file/d/1AbC/preview",
    );

    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expect(result.reason).toBeTruthy();
    }
  });
});
