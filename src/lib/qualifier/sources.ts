import { createHash } from "node:crypto";
import { getNotionDetail, type NotionDetail } from "@/lib/notion-detail";
import { fetchCandidateFile, MAX_FILES_PER_CANDIDATE } from "./files";
import type { EvidenceBundle, FetchedFile, SourceRecord } from "./types";

export const FILE_PROP_LABELS = ["Resume", "Portfolio"] as const;
const LINK_PROP_LABELS = ["Portfolio Link"] as const;

export function collectFileTargets(detail: NotionDetail): { label: string; url: string }[] {
  const targets: { label: string; url: string }[] = [];
  for (const label of FILE_PROP_LABELS) {
    const prop = detail.allProps.find((p) => p.name === label && p.type === "files");
    if (!prop) continue;
    const urls = Array.isArray(prop.value) ? (prop.value as string[]) : [];
    for (const url of urls) targets.push({ label, url });
  }
  return targets.slice(0, MAX_FILES_PER_CANDIDATE);
}

/** Text evidence only. File contents travel as document/image blocks, not as URLs. */
export function buildTextContext(detail: NotionDetail, candidateName: string): string {
  const lines: string[] = [`# ข้อมูลผู้สมัคร`, `ชื่อ: ${candidateName || "ไม่ระบุ"}`];

  const skip = new Set<string>([...FILE_PROP_LABELS, ...LINK_PROP_LABELS]);
  for (const prop of detail.allProps) {
    if (skip.has(prop.name) || prop.type === "files") continue;
    const value = Array.isArray(prop.value) ? prop.value.join(", ") : String(prop.value);
    if (value.trim()) lines.push(`${prop.name}: ${value}`);
  }

  if (detail.qa.length > 0) {
    lines.push(``, `# คำถามเชิงลึก`);
    for (const { question, answer } of detail.qa) lines.push(`Q: ${question}`, `A: ${answer}`);
  }

  return lines.join("\n");
}

export function buildSourceRecords(
  targets: { label: string; url: string }[],
  files: FetchedFile[],
  detail: NotionDetail,
): SourceRecord[] {
  const records: SourceRecord[] = [];

  for (const label of FILE_PROP_LABELS) {
    const target = targets.find((t) => t.label === label);
    if (!target) {
      records.push({ label, status: "not_provided", detail: "ผู้สมัครไม่ได้แนบไฟล์" });
      continue;
    }
    const file = files.find((f) => f.label === label);
    if (file && file.kind !== "unavailable") {
      records.push({
        label, status: "read",
        detail: file.kind === "pdf" ? "อ่านไฟล์ PDF แล้ว" : "อ่านไฟล์รูปภาพแล้ว",
      });
    } else {
      records.push({
        label, status: "unavailable",
        detail: file?.reason ?? "ดาวน์โหลดไฟล์ไม่สำเร็จ",
      });
    }
  }

  for (const label of LINK_PROP_LABELS) {
    const prop = detail.allProps.find((p) => p.name === label);
    if (!prop) continue;
    records.push({
      label, status: "not_provided",
      detail: `เป็นลิงก์ภายนอก (${String(prop.value)}) — AI เปิดดูไม่ได้ ต้องให้คนตรวจเอง`,
    });
  }

  records.push({
    label: "คำถามเชิงลึก",
    status: detail.qa.length > 0 ? "read" : "not_provided",
    detail: `${detail.qa.length} ข้อ`,
  });

  return records;
}

export function computeInputHash(textContext: string, files: FetchedFile[]): string {
  const fingerprint = [
    textContext,
    ...files.map((f) => `${f.label}:${f.sourceUrl}:${f.kind}`),
  ].join(" ");
  return createHash("sha256").update(fingerprint).digest("hex");
}

export interface CandidateForEvidence {
  id: string;
  fullName: string | null;
  nickname: string | null;
  notionPageId: string | null;
  interestedPositionId: string | null;
}

/** Throws if the Notion page is missing or the Notion API fails — never returns partial evidence. */
export async function gatherEvidence(candidate: CandidateForEvidence): Promise<EvidenceBundle> {
  if (!candidate.notionPageId) {
    throw new Error("ผู้สมัครรายนี้ยังไม่มีข้อมูลใน Notion — ประเมินไม่ได้");
  }

  const detail = await getNotionDetail(candidate.notionPageId);
  const targets = collectFileTargets(detail);
  const files = await Promise.all(targets.map((t) => fetchCandidateFile(t.label, t.url)));

  const textContext = buildTextContext(
    detail,
    candidate.fullName ?? candidate.nickname ?? "",
  );

  return {
    candidateId: candidate.id,
    jobPositionId: candidate.interestedPositionId,
    textContext,
    files,
    sources: buildSourceRecords(targets, files, detail),
    inputHash: computeInputHash(textContext, files),
  };
}
