import type { WorkPreference } from "@prisma/client";
import { callJson, resolveAiConfig, type AiConfig } from "./ai";
import { scrubContacts } from "./scrub";
import { EMPTY_FACTS, type ExtractedFacts, type FactKey } from "./types";

/**
 * Read a candidate's conversation and pull out the facts HR filters on.
 *
 * This is the load-bearing half of the feature. `Candidate` already has
 * columns for all of this, but on a 5,959-row database `age` is filled on 19
 * rows and `max_sales_amount` on none: หลิน asks the questions in chat and the
 * answers were only ever stored as prose. Everything downstream — filtering,
 * ranking, the existing candidate-search assistant — is starved until these
 * columns are populated.
 */

export interface TranscriptMessage {
  senderType: "CANDIDATE" | "BOT" | "HR" | "SYSTEM";
  content: string;
}

const SPEAKER: Record<TranscriptMessage["senderType"], string> = {
  CANDIDATE: "ผู้สมัคร",
  BOT: "บอท",
  HR: "HR",
  SYSTEM: "ระบบ",
};

/**
 * Render messages as a transcript.
 *
 * Bot turns are kept, not dropped: a bare "20000" from a candidate is
 * meaningless without the question that preceded it. SYSTEM turns are dropped —
 * they are plumbing, and they dilute the transcript with text no human said.
 */
export function buildTranscript(messages: TranscriptMessage[]): string {
  return messages
    .filter((m) => m.senderType !== "SYSTEM")
    .map((m) => `${SPEAKER[m.senderType]}: ${m.content.trim()}`)
    .filter((line) => line.length > 6)
    .join("\n");
}

const SYSTEM_PROMPT = `คุณคือผู้ช่วยฝ่ายบุคคล อ่านบทสนทนาระหว่างผู้สมัครกับบอทรับสมัครงาน
แล้วดึง "ข้อเท็จจริง" ออกมา ตอบกลับเป็น JSON object เท่านั้น

ฟิลด์ที่ต้องดึง:
- age: อายุ (ตัวเลข ปี)
- workPreference: "ONSITE" ถ้าผู้สมัครรับงานเข้าออฟฟิศ/inhouse ได้,
                  "WFH" ถ้าต้องการทำงานที่บ้านเท่านั้น,
                  "HYBRID" ถ้ารับได้ทั้งสองแบบ
- expectedSalary: เงินเดือนที่ผู้สมัคร "ขอ" (บาท/เดือน เป็นตัวเลขล้วน)
- experienceYears: จำนวนปีประสบการณ์ทำงานที่เกี่ยวข้อง
- maxSalesAmount: ยอดขายสูงสุดต่อเดือนที่เคยทำได้ (บาท)
- experienceText: สรุปประสบการณ์ทำงานสั้น ๆ 1-2 ประโยค จากคำพูดของผู้สมัครเอง

กฎเหล็ก:
- ถ้าบทสนทนาไม่ได้บอกเรื่องไหน ให้ใส่ null ห้ามเดา ห้ามใส่ 0 แทน null
  (0 แปลว่า "ตอบมาว่าศูนย์" ซึ่งคนละเรื่องกับ "ไม่ได้พูดถึง")
- ถ้าผู้สมัครพูดเป็นช่วง เช่น "15000-18000" ให้เอาตัวเลขต่ำสุด
- ถ้าผู้สมัครบอกว่า "แล้วแต่บริษัท" เรื่องเงินเดือน ให้เป็น null
- ห้ามดึงชื่อ เบอร์โทร อีเมล หรือไอดีไลน์

รูปแบบคำตอบ:
{ "age": null, "workPreference": null, "expectedSalary": null,
  "experienceYears": null, "maxSalesAmount": null, "experienceText": null }`;

/** Positive integer within a sane range, else null. Never coerces to 0. */
function asInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i >= min && i <= max ? i : null;
}

function asWorkPreference(v: unknown): WorkPreference | null {
  if (typeof v !== "string") return null;
  const up = v.toUpperCase().trim();
  return up === "ONSITE" || up === "WFH" || up === "HYBRID" ? (up as WorkPreference) : null;
}

/**
 * Normalise a raw extraction response.
 *
 * The ranges are deliberate sanity bounds: a model that reads a phone number as
 * an age produces 812345678, and a filter comparing that to `maxAge: 40` would
 * silently reject a perfectly good candidate.
 */
export function normaliseFacts(raw: unknown): ExtractedFacts {
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = typeof r.experienceText === "string" ? r.experienceText.trim() : "";
  return {
    ...EMPTY_FACTS,
    age: asInt(r.age, 15, 80),
    workPreference: asWorkPreference(r.workPreference),
    expectedSalary: asInt(r.expectedSalary, 1000, 1_000_000),
    // 0 years is a real answer ("ไม่เคยทำงานมาก่อน"), so the floor is 0 here —
    // unlike the fields above, where 0 is never meaningful.
    experienceYears: asInt(r.experienceYears, 0, 60),
    maxSalesAmount: asInt(r.maxSalesAmount, 1, 1_000_000_000),
    experienceText: text.length > 3 ? text : null,
  };
}

/** Which fields the transcript actually supported — provenance, not values. */
export function foundFields(facts: ExtractedFacts): FactKey[] {
  return (Object.keys(facts) as FactKey[]).filter((k) => facts[k] !== null);
}

export async function extractFacts(
  messages: TranscriptMessage[],
  config?: AiConfig,
): Promise<{
  facts: ExtractedFacts;
  model: string;
  promptTokens: number;
  completionTokens: number;
}> {
  const transcript = scrubContacts(buildTranscript(messages));
  if (!transcript.trim()) {
    return { facts: EMPTY_FACTS, model: "", promptTokens: 0, completionTokens: 0 };
  }

  const cfg = config ?? (await resolveAiConfig());
  const res = await callJson<unknown>(cfg, SYSTEM_PROMPT, `บทสนทนา:\n${transcript}`, 1000);
  return {
    facts: normaliseFacts(res.data),
    model: res.model,
    promptTokens: res.promptTokens,
    completionTokens: res.completionTokens,
  };
}
