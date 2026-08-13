import type { FetchedFile } from "./types";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES_PER_CANDIDATE = 2;
export const MAX_PDF_PAGES = 20;

/**
 * The Apps Script writes `https://drive.google.com/file/d/<ID>/preview` into the
 * Notion `Resume` / `Portfolio` file property (appscript.script:39).
 * Also tolerate /view and open?id= forms.
 */
export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const path = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  if (path) return path[1];
  const query = url.match(/drive\.google\.com\/(?:open|uc)\?[^#]*\bid=([A-Za-z0-9_-]+)/);
  if (query) return query[1];
  return null;
}

/** A /preview URL is a viewer page, not the file. Rewrite it to the bytes. */
export function toDownloadUrl(url: string): string | null {
  const id = extractDriveFileId(url);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : null;
}

const startsWith = (b: Uint8Array, sig: number[]) =>
  b.length >= sig.length && sig.every((v, i) => b[i] === v);

/**
 * Classify by magic bytes ONLY. Google returns HTTP 200 + text/html for the real
 * file, for a sign-in page (setSharing failed and was swallowed at
 * appscript.script:38), and for the virus-scan interstitial — so the
 * Content-Type header cannot distinguish them.
 */
export function classifyBytes(
  bytes: Uint8Array,
): { kind: "pdf" | "image"; mediaType: string } | null {
  if (bytes.length < 4) return null;
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) {
    return { kind: "pdf", mediaType: "application/pdf" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { kind: "image", mediaType: "image/jpeg" };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "image", mediaType: "image/png" };
  }
  return null; // HTML sign-in page, interstitial, DOCX zip, anything else
}

/**
 * Cheap page count without a PDF parser: count `/Type /Page` object markers,
 * excluding the `/Type /Pages` tree node. Returns 0 when the PDF uses compressed
 * object streams and the markers are not visible in the raw bytes — callers must
 * treat 0 as "unknown" and let the file through rather than rejecting it.
 */
export function countPdfPages(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?![sA-Za-z])/g);
  return matches ? matches.length : 0;
}

const unavailable = (label: string, sourceUrl: string, reason: string): FetchedFile => ({
  label, sourceUrl, kind: "unavailable", reason,
});

/** Download one candidate file. Never throws — an unreadable file is data, not an error. */
export async function fetchCandidateFile(label: string, url: string): Promise<FetchedFile> {
  const downloadUrl = toDownloadUrl(url);
  if (!downloadUrl) {
    return unavailable(label, url, "ไม่ใช่ไฟล์บน Google Drive (เป็นลิงก์ภายนอก) — AI อ่านไม่ได้");
  }

  let buf: Uint8Array;
  try {
    const res = await fetch(downloadUrl, { redirect: "follow" });
    if (!res.ok) {
      return unavailable(label, url, `ดาวน์โหลดไฟล์ไม่สำเร็จ (HTTP ${res.status})`);
    }
    buf = new Uint8Array(await res.arrayBuffer());
  } catch {
    return unavailable(label, url, "ดาวน์โหลดไฟล์ไม่สำเร็จ (network error)");
  }
  if (buf.byteLength > MAX_FILE_BYTES) {
    return unavailable(label, url, `ไฟล์ใหญ่เกิน ${MAX_FILE_BYTES / 1024 / 1024} MB`);
  }

  const classified = classifyBytes(buf);
  if (!classified) {
    return unavailable(
      label, url,
      "ไฟล์อ่านไม่ได้ (อาจไม่ได้เปิดสิทธิ์แชร์ หรือเป็นไฟล์ประเภทที่ยังไม่รองรับ)",
    );
  }

  if (classified.kind === "pdf") {
    const pages = countPdfPages(buf);
    // 0 means "could not tell" — let it through rather than rejecting a valid file.
    if (pages > MAX_PDF_PAGES) {
      return unavailable(label, url, `ไฟล์ยาวเกิน ${MAX_PDF_PAGES} หน้า (${pages} หน้า)`);
    }
  }

  return {
    label,
    sourceUrl: url,
    kind: classified.kind,
    mediaType: classified.mediaType,
    base64: Buffer.from(buf).toString("base64"),
  };
}
