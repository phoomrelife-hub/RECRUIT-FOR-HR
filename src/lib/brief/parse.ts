import { callJson, resolveAiConfig, type AiConfig } from "./ai";
import { redactCriteria } from "./redact";
import { EMPTY_HARD_FILTERS, type BriefCriterion, type ParsedBrief } from "./types";
import type { WorkPreference } from "@prisma/client";

/**
 * Turn HR's free-text Thai brief into the two halves the pipeline needs.
 *
 * The model's job here is TRANSLATION, not judgement: it decides which words
 * are a checkable number (-> a column) and which are a quality (-> a criterion).
 * It never sees a candidate at this stage.
 */

const SYSTEM_PROMPT = `คุณคือผู้ช่วยฝ่ายบุคคล แปลงบรีฟหาคนของ HR ให้เป็นเกณฑ์คัดกรองที่ใช้งานได้
ตอบกลับเป็น JSON object เท่านั้น

แยกบรีฟออกเป็น 2 ส่วน:

1) filters — เงื่อนไขที่เป็น "ตัวเลขหรือตัวเลือกที่ตรวจสอบได้"
   - minAge, maxAge: อายุ (ปี)
   - minSalary, maxSalary: เงินเดือน (บาท/เดือน) — maxSalary คืองบสูงสุดที่บริษัทจ่ายไหว
   - workPreference: "ONSITE" (เข้าออฟฟิศ/inhouse) | "WFH" | "HYBRID"
   - minExperienceYears: ประสบการณ์ขั้นต่ำ (ปี)
   - minSalesAmount: ยอดขายขั้นต่ำที่เคยทำได้ (บาท/เดือน)
   ถ้า HR ไม่ได้ระบุข้อไหน ให้ใส่ null ห้ามเดา

2) criteria — คุณสมบัติเชิงคุณภาพที่ต้อง "อ่านแล้วตัดสิน" เช่น ความตั้งใจ ทักษะสื่อสาร
   ประเภทสินค้าที่เคยขาย ทัศนคติ
   แต่ละข้อ: { "name": ชื่อสั้น ๆ, "weight": 1-5 ตามความสำคัญ, "description": สิ่งที่ต้องดู }
   ต้องมี "อย่างน้อย 3 ข้อ" และไม่เกิน 6 ข้อ
   ถ้าบรีฟสั้นจนได้ไม่ถึง 3 ข้อ ให้เพิ่มเกณฑ์กลาง ๆ ที่ประเมินได้จากใบสมัครเสมอ เช่น
   "ความเหมาะสมกับตำแหน่งโดยรวม", "ทักษะการสื่อสาร", "ความตั้งใจและแรงจูงใจ"
   สำคัญ: เกณฑ์ต้องกว้างพอที่ผู้สมัครทั่วไปจะมีข้อมูลให้ประเมินได้
   ถ้าเกณฑ์เฉพาะเจาะจงเกินไปจนแทบไม่มีใครตอบได้ ทุกคนจะได้คะแนนเท่ากันหมดและจัดอันดับไม่ได้

กฎสำคัญ:
- อะไรที่ใส่ใน filters ได้แล้ว ห้ามใส่ซ้ำใน criteria อีก
  (เช่น ถ้า HR เขียน "อายุ 20-40" ให้ลงเป็น minAge/maxAge เท่านั้น
   ห้ามสร้าง criteria ชื่อ "อายุเหมาะสม")
- ห้ามใส่ อายุ เพศ ศาสนา สถานภาพสมรส หรือจำนวนบุตร ลงใน criteria เด็ดขาด
- ดึงเฉพาะสิ่งที่ HR เขียนจริง ห้ามเติมเงื่อนไขที่เขาไม่ได้ขอ

รูปแบบคำตอบ:
{
  "filters": { "minAge": null, "maxAge": null, "minSalary": null, "maxSalary": null,
               "workPreference": null, "minExperienceYears": null, "minSalesAmount": null },
  "criteria": [ { "name": "...", "weight": 3, "description": "..." } ]
}`;

const WORK_VALUES: WorkPreference[] = ["ONSITE", "WFH", "HYBRID"];

/** Accept a positive integer, reject anything else (including 0 and "20-40"). */
function asInt(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i > 0 ? i : null;
}

function asWorkPreference(v: unknown): WorkPreference | null {
  if (typeof v !== "string") return null;
  const up = v.toUpperCase().trim();
  return (WORK_VALUES as string[]).includes(up) ? (up as WorkPreference) : null;
}

function asCriteria(v: unknown): BriefCriterion[] {
  if (!Array.isArray(v)) return [];
  const out: BriefCriterion[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name) continue;
    const weight = asInt(r.weight) ?? 1;
    out.push({
      name,
      weight: Math.max(1, Math.min(5, weight)),
      description: typeof r.description === "string" ? r.description.trim() : "",
    });
  }
  return out;
}

/**
 * Normalise a raw model response into a ParsedBrief.
 *
 * Exported so the shape handling is unit-testable without an API key — every
 * defensive branch here exists because a model returned that shape at least
 * once somewhere.
 */
export function normaliseParsedBrief(raw: unknown): ParsedBrief {
  const r = (raw ?? {}) as Record<string, unknown>;
  const f = (r.filters ?? {}) as Record<string, unknown>;

  let minAge = asInt(f.minAge);
  let maxAge = asInt(f.maxAge);
  // A swapped range would reject everybody while looking correct in the UI.
  if (minAge !== null && maxAge !== null && minAge > maxAge) [minAge, maxAge] = [maxAge, minAge];

  let minSalary = asInt(f.minSalary);
  let maxSalary = asInt(f.maxSalary);
  if (minSalary !== null && maxSalary !== null && minSalary > maxSalary) {
    [minSalary, maxSalary] = [maxSalary, minSalary];
  }

  return {
    filters: {
      ...EMPTY_HARD_FILTERS,
      minAge,
      maxAge,
      minSalary,
      maxSalary,
      workPreference: asWorkPreference(f.workPreference),
      minExperienceYears: asInt(f.minExperienceYears),
      minSalesAmount: asInt(f.minSalesAmount),
    },
    // Backstop only. The prompt already forbids protected attributes; this
    // catches the times it does it anyway.
    criteria: redactCriteria(asCriteria(r.criteria)),
  };
}

/**
 * Criteria that can be judged from any reasonably complete application.
 *
 * WHY THIS EXISTS — the first live run produced five candidates, all 1 star,
 * indistinguishable. The brief had parsed to a SINGLE criterion
 * ("ประสบการณ์ขายสินค้าสุขภาพ"), and with one criterion coverage is binary:
 * either the transcript answers it or the candidate scores 0% and gets capped
 * to the floor. Nobody's form said which product category they had sold, so
 * everybody landed in the same place and the ranking carried no information.
 *
 * The model was right each time — it correctly returned null for "no evidence".
 * The design was wrong: one narrow gate cannot rank people.
 */
const FALLBACK_CRITERIA: BriefCriterion[] = [
  {
    name: "ความเหมาะสมกับตำแหน่งโดยรวม",
    weight: 3,
    description: "ประสบการณ์และทักษะโดยรวมเหมาะกับตำแหน่งนี้แค่ไหน",
  },
  {
    name: "ทักษะการสื่อสาร",
    weight: 2,
    description: "อธิบายได้ชัดเจน ตอบตรงคำถาม เขียนสื่อสารรู้เรื่อง",
  },
  {
    name: "ความตั้งใจและแรงจูงใจ",
    weight: 2,
    description: "ให้ข้อมูลครบถ้วน ตอบคำถามอย่างตั้งใจ แสดงความสนใจในงาน",
  },
];

/** Below this, coverage becomes all-or-nothing and the ranking collapses. */
export const MIN_CRITERIA = 3;

/**
 * Top a thin brief up to MIN_CRITERIA with generally-answerable criteria.
 *
 * Appended, never substituted: HR's own wording always stays and keeps its
 * weight. The additions only ensure there is enough scoreable surface for the
 * ranking to separate people.
 */
export function withFallbackCriteria(criteria: BriefCriterion[]): BriefCriterion[] {
  if (criteria.length >= MIN_CRITERIA) return criteria;
  const have = new Set(criteria.map((c) => c.name.replace(/\s+/g, "")));
  const out = [...criteria];
  for (const f of FALLBACK_CRITERIA) {
    if (out.length >= MIN_CRITERIA) break;
    if (have.has(f.name.replace(/\s+/g, ""))) continue;
    out.push(f);
  }
  return out;
}

export async function parseBrief(
  rawBrief: string,
  positionTitle: string | null,
  config?: AiConfig,
): Promise<{ parsed: ParsedBrief; model: string; promptTokens: number; completionTokens: number }> {
  const cfg = config ?? (await resolveAiConfig());
  const user = [
    positionTitle ? `ตำแหน่งที่เปิดรับ: ${positionTitle}` : "",
    `บรีฟจาก HR:\n${rawBrief}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await callJson<unknown>(cfg, SYSTEM_PROMPT, user, 2000);
  const parsed = normaliseParsedBrief(res.data);
  return {
    // Topped up HERE rather than inside normaliseParsedBrief, so the normaliser
    // stays a pure description of what the model said and the fallback stays a
    // product decision about what a usable brief needs.
    parsed: { ...parsed, criteria: withFallbackCriteria(parsed.criteria) },
    model: res.model,
    promptTokens: res.promptTokens,
    completionTokens: res.completionTokens,
  };
}
