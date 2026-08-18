import { callJson, resolveAiConfig, type AiConfig } from "./ai";
import { scrubContacts } from "./scrub";
import { buildTranscript, type TranscriptMessage } from "./extract";
import type { BriefCriterion, CriterionScore, Judgement } from "./types";

/**
 * Judge one candidate against the free-text half of a brief.
 *
 * The model returns criterion scores and a reason — and NOTHING else. It never
 * names a verdict or a star count: those are derived in stars.ts from the
 * scores plus coverage, so the low-coverage cap is authoritative. A model that
 * could assert its own star rating could simply claim 5 and route around it.
 */

export class CriterionDriftError extends Error {
  constructor(expected: string[], got: string[]) {
    super(
      `AI ตอบชื่อเกณฑ์ไม่ตรงกับที่ส่งไป — ต้องการ [${expected.join(", ")}] แต่ได้ [${got.join(", ")}]`,
    );
    this.name = "CriterionDriftError";
  }
}

const SYSTEM_PROMPT = `คุณคือผู้ช่วยฝ่ายบุคคล ประเมินว่าผู้สมัครคนนี้ตรงกับที่ HR ต้องการหรือไม่
ตอบกลับเป็น JSON object เท่านั้น

กฎเหล็ก:
- ตัดสินจากบทสนทนาที่ให้มาเท่านั้น ห้ามแต่งประสบการณ์ที่ผู้สมัครไม่ได้พูด
- เกณฑ์ข้อไหนไม่มีหลักฐานรองรับเลย ให้ score เป็น null ห้ามให้ 0 แทน
  (0 = มีหลักฐานแล้วแย่ ซึ่งคนละเรื่องกับ "ไม่รู้")
- ข้อมูลของแต่ละคนยาวไม่เท่ากัน คนที่คุยน้อยไม่ได้แปลว่าแย่ — ให้ null ในข้อที่ไม่รู้
- ชื่อเกณฑ์ใน "name" ต้องตรงกับที่ส่งมาเป๊ะ ๆ ห้ามเติมน้ำหนัก วงเล็บ หรือคำอธิบาย
- อายุ เพศ ที่อยู่ และสถานะส่วนตัว ถูกตัดออกจากข้อมูลโดยตั้งใจ และ HR ตรวจแยกต่างหากแล้ว
  ห้ามใช้เป็นเหตุผล และห้ามบอกว่า "ขาดข้อมูลเรื่องอายุ"
- ห้ามให้ดาวหรือสรุปว่าผ่าน/ไม่ผ่าน — ให้แค่คะแนนรายข้อกับเหตุผล

รูปแบบคำตอบ:
{ "criteria": [ { "name": "ชื่อเกณฑ์ตรงเป๊ะ", "score": 0-10 หรือ null, "reasoning": "อ้างสิ่งที่ผู้สมัครพิมพ์จริง" } ],
  "why": "สรุป 2-3 ประโยคว่าคนนี้น่าสนใจหรือไม่ เพราะอะไร" }`;

/** Loose key for matching a returned name back to an expected one. */
function normKey(s: string): string {
  return s
    // "ประสบการณ์ขาย (น้ำหนัก 3)" -> "ประสบการณ์ขาย"
    .replace(/[(（].*?[)）]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();
}

function asScore(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n)));
}

/**
 * Map the model's returned criteria back onto the ones we asked about.
 *
 * WHY THIS IS NOT A ONE-LINER — the exact bug it prevents, seen live in the ERP
 * build: the model answered with "ประสบการณ์ขาย (น้ำหนัก 3)" instead of
 * "ประสบการณ์ขาย". Every lookup missed, every criterion came back unscored, and
 * the result was a 0%-coverage candidate — which is INDISTINGUISHABLE from a
 * genuine no-evidence candidate. Scores silently went to zero for everyone and
 * nothing errored.
 *
 * So: match loosely, then insist that at least ONE name matched. Total drift is
 * a thrown error, never a quietly empty result.
 */
export function alignCriteria(
  expected: BriefCriterion[],
  returned: Array<{ name?: unknown; score?: unknown; reasoning?: unknown }>,
): CriterionScore[] {
  const byKey = new Map<string, (typeof returned)[number]>();
  for (const r of returned) {
    if (typeof r?.name === "string") byKey.set(normKey(r.name), r);
  }

  let matched = 0;
  const out = expected.map((c) => {
    const hit = byKey.get(normKey(c.name));
    if (hit) matched++;
    return {
      name: c.name,
      score: hit ? asScore(hit.score) : null,
      reasoning: typeof hit?.reasoning === "string" ? hit.reasoning.trim() : "ไม่มีข้อมูล",
    };
  });

  if (expected.length > 0 && matched === 0) {
    throw new CriterionDriftError(
      expected.map((c) => c.name),
      returned.map((r) => String(r?.name ?? "?")),
    );
  }
  return out;
}

export function normaliseJudgement(raw: unknown, expected: BriefCriterion[]): Judgement {
  const r = (raw ?? {}) as Record<string, unknown>;
  const returned = Array.isArray(r.criteria) ? r.criteria : [];
  return {
    criteria: alignCriteria(expected, returned),
    why: typeof r.why === "string" ? r.why.trim() : "",
  };
}

function renderCriteria(criteria: BriefCriterion[]): string {
  return criteria
    .map((c) => `- "${c.name}" (น้ำหนัก ${c.weight})${c.description ? `: ${c.description}` : ""}`)
    .join("\n");
}

export async function scoreCandidate(
  criteria: BriefCriterion[],
  messages: TranscriptMessage[],
  positionTitle: string | null,
  config?: AiConfig,
  /**
   * Form answers from Notion, rendered by renderNotionEvidence.
   *
   * Listed BEFORE the chat transcript in the prompt because it is the better
   * evidence by a wide margin: ~14 considered written answers, versus a chat
   * where the candidate mostly asked about the commute. Scoring on chat alone
   * is what produced a run where every criterion came back null.
   */
  notionEvidence?: string,
): Promise<{
  judgement: Judgement;
  model: string;
  promptTokens: number;
  completionTokens: number;
}> {
  const cfg = config ?? (await resolveAiConfig());
  const transcript = scrubContacts(buildTranscript(messages));

  const user = [
    positionTitle ? `ตำแหน่งที่เปิดรับ: ${positionTitle}` : "",
    `เกณฑ์ที่ต้องให้คะแนน:\n${renderCriteria(criteria)}`,
    // Form answers first: ~14 considered written responses outweigh a chat in
    // which the candidate mostly asked about the commute. Scrubbed again here
    // rather than trusting the caller — the form collects phone, email and LINE
    // ID, and this is the last point before the text leaves the process.
    notionEvidence ? `ข้อมูลจากใบสมัคร:\n${scrubContacts(notionEvidence)}` : "",
    transcript ? `บทสนทนาของผู้สมัคร:\n${transcript}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await callJson<unknown>(cfg, SYSTEM_PROMPT, user, 3000);
  return {
    judgement: normaliseJudgement(res.data, criteria),
    model: res.model,
    promptTokens: res.promptTokens,
    completionTokens: res.completionTokens,
  };
}
