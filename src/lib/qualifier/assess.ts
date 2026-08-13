import { z } from "zod";
import { getSetting } from "@/lib/assistant/config";
import type { AssessmentOutput, EvidenceBundle, ResolvedRubric } from "./types";

// Ported from Anthropic (claude-sonnet-5) to OpenAI. gpt-5.6-luna is a reasoning
// model: it HARD-400s if the request includes `temperature` or `max_tokens`, so
// neither is ever sent (see callChatCompletions below).
export const QUALIFIER_MODEL = "gpt-5.6-luna";
export const PROMPT_VERSION = "qualifier-v1";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

const INTERVIEW_AXES = [
  "communication", "personality", "experience",
  "roleUnderstanding", "availability", "attitude",
] as const;

export const assessmentSchema = z.object({
  summary: z.string(),
  strengths: z.string(),
  concerns: z.string(),
  redFlags: z.string(),
  unverifiedClaims: z.string(),
  criteria: z.array(z.object({
    name: z.string(),
    score: z.number().int().min(0).max(10).nullable(),
    reasoning: z.string(),
  })),
  interviewQuestions: z.array(z.object({
    axis: z.enum(INTERVIEW_AXES),
    question: z.string(),
    why: z.string(),
  })),
});

export function buildPrompt(evidence: EvidenceBundle, rubric: ResolvedRubric): string {
  const criteria = rubric.criteria
    .map((c) => `- "${c.name}" (น้ำหนัก ${c.weight}): ${c.description || "ไม่มีคำอธิบาย"}`)
    .join("\n");

  const sources = evidence.sources
    .map((s) => `- ${s.label}: ${s.status === "read" ? "อ่านได้" : "อ่านไม่ได้"} — ${s.detail}`)
    .join("\n");

  const fallbackNote = rubric.isGlobalFallback
    ? "\n**หมายเหตุ:** ตำแหน่งนี้ยังไม่มีเกณฑ์เฉพาะ กำลังใช้เกณฑ์กลางของบริษัท\n"
    : "";

  return `คุณเป็นผู้ช่วย HR ของ Relife Solutions บริษัท E-Commerce ด้านสุขภาพและความงาม
หน้าที่ของคุณคือประเมินผู้สมัครตามเกณฑ์ที่ HR กำหนด และเตรียมคำถามสัมภาษณ์ให้ HR

# เกณฑ์การให้คะแนน (rubric)
${criteria}
${fallbackNote}
# หลักฐานที่มี
${sources}

# กฎเหล็ก — ห้ามฝ่าฝืน
1. ให้คะแนนเฉพาะเกณฑ์ที่ "มีหลักฐานรองรับจริง" เท่านั้น
   ถ้าไม่มีหลักฐาน ให้ score เป็น **null** และอธิบายใน reasoning ว่าขาดอะไร
   **ห้ามให้ 0 แทน null** — 0 แปลว่าแย่ ส่วน null แปลว่ายังไม่ได้ประเมิน
2. ห้ามแต่งข้อมูลที่ไม่มีในหลักฐาน ถ้าไม่แน่ใจให้บอกว่าไม่แน่ใจ
3. ถ้าไฟล์ Portfolio อ่านไม่ได้ ห้ามเดาว่าผลงานดีหรือไม่ดี
4. ข้อมูลที่ผู้สมัครอ้างเองแต่ไม่มีหลักฐานยืนยัน (เช่น ยอดขายสูงสุดต่อเดือน)
   ต้องใส่ใน unverifiedClaims **และต้องมีคำถามสัมภาษณ์ที่ตรวจสอบข้ออ้างนั้นทุกข้อ**
5. คำถามสัมภาษณ์ต้องมาจาก concerns / redFlags / unverifiedClaims ของคุณเอง
   ไม่ใช่คำถามทั่วไป และต้องระบุ why ว่าถามเพราะอะไร
6. ห้ามใช้คำที่อ้างการรักษาโรค และห้ามเปรียบเทียบเชิงลบกับคู่แข่ง

# ข้อมูลผู้สมัคร
${evidence.textContext}

ตอบกลับด้วยเครื่องมือ submit_assessment เท่านั้น ทุกข้อความเป็นภาษาไทย`;
}

export type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

/**
 * evidence.files → OpenAI content parts. `opts.omitFiles` is the file-rejection
 * fallback: text only, used when the model has already rejected a file/image
 * part once (see runAssessment).
 */
export function buildContentBlocks(
  evidence: EvidenceBundle,
  rubric: ResolvedRubric,
  opts: { omitFiles?: boolean } = {},
): OpenAIContentPart[] {
  const blocks: OpenAIContentPart[] = [
    { type: "text", text: buildPrompt(evidence, rubric) },
  ];

  if (opts.omitFiles) return blocks;

  for (const file of evidence.files) {
    if (file.kind === "unavailable" || !file.base64 || !file.mediaType) continue;

    blocks.push({ type: "text", text: `--- ไฟล์: ${file.label} ---` });

    if (file.kind === "pdf") {
      blocks.push({
        type: "file",
        file: {
          filename: `${file.label}.pdf`,
          file_data: `data:application/pdf;base64,${file.base64}`,
        },
      });
    } else {
      blocks.push({
        type: "image_url",
        image_url: { url: `data:${file.mediaType};base64,${file.base64}` },
      });
    }
  }

  return blocks;
}

const TOOL = {
  type: "function",
  function: {
    name: "submit_assessment",
    description: "ส่งผลการประเมินผู้สมัครและคำถามสัมภาษณ์",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "สรุปภาพรวมผู้สมัคร 2-4 ประโยค" },
        strengths: { type: "string", description: "จุดแข็ง คั่นแต่ละข้อด้วย |" },
        concerns: { type: "string", description: "ข้อกังวล คั่นแต่ละข้อด้วย |" },
        redFlags: { type: "string", description: "สัญญาณอันตราย ถ้าไม่มีให้ส่งสตริงว่าง" },
        unverifiedClaims: { type: "string", description: "ข้ออ้างที่ยังไม่มีหลักฐาน คั่นด้วย |" },
        criteria: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "ต้องตรงกับชื่อเกณฑ์เป๊ะ ๆ" },
              score: { type: ["number", "null"], description: "0-10 (จำนวนเต็ม) หรือ null ถ้าไม่มีหลักฐาน" },
              reasoning: { type: "string" },
            },
            required: ["name", "score", "reasoning"],
          },
        },
        interviewQuestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              axis: { type: "string", enum: [...INTERVIEW_AXES] },
              question: { type: "string" },
              why: { type: "string" },
            },
            required: ["axis", "question", "why"],
          },
        },
      },
      required: [
        "summary", "strengths", "concerns", "redFlags",
        "unverifiedClaims", "criteria", "interviewQuestions",
      ],
    },
  },
} as const;

export class AssessmentFormatError extends Error {
  constructor(detail: string) {
    super(`AI ตอบกลับในรูปแบบที่ไม่ถูกต้อง: ${detail}`);
    this.name = "AssessmentFormatError";
  }
}

/**
 * Distinct from a generic OpenAI/network failure: this means the operator
 * hasn't configured a key at all — no request was ever sent. Routes map this
 * to 422 ("the operator must fix configuration"), the same class of problem
 * as NoRubricError, rather than the 502 ("upstream failed, retry") used for a
 * real API error.
 */
export class MissingApiKeyError extends Error {
  constructor() {
    super("ยังไม่ได้ตั้งค่า OpenAI API Key (openai.api_key หรือ OPENAI_API_KEY)");
    this.name = "MissingApiKeyError";
  }
}

/** Resolve the OpenAI key (Setting row, then env var) and model (Setting row, then code default). */
export async function resolveOpenAiConfig(): Promise<{ apiKey: string; model: string }> {
  const [dbKey, dbModel] = await Promise.all([
    getSetting("openai.api_key"),
    getSetting("qualifier.model"),
  ]);
  const apiKey = dbKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();
  return { apiKey, model: dbModel || QUALIFIER_MODEL };
}

/**
 * data.error from the OpenAI API is usually `{ message: string, ... }`, but
 * isn't guaranteed to have a `message` field. `String(errorObject)` on a plain
 * object yields the useless "[object Object]" (which also silently defeats
 * isFileContentRejection's message matching) — serialise the whole object
 * instead when there's no usable message string.
 */
export function stringifyApiError(error: unknown): string {
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string") return message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

/**
 * Heuristic for "the model/endpoint rejected the file or image content part,"
 * vs. some other API error. OpenAI does not have a single stable error code for
 * this across models, so this matches on the vocabulary providers use for it
 * (e.g. "Invalid content type. image_url is not supported by this model.",
 * "'file' is not a valid content part for this model."). Deliberately broad —
 * a false positive just costs one extra text-only retry, whereas a false
 * negative would let an unread resume produce a confident score.
 */
export function isFileContentRejection(message: string): boolean {
  const m = message.toLowerCase();
  const mentionsFileContent = /image_url|file_data|\bimage\b|\bfile\b|\bpdf\b|content part/.test(m);
  const mentionsRejection = /unsupported|not supported|does not support|invalid|not a valid|cannot process|rejected/.test(m);
  return mentionsFileContent && mentionsRejection;
}

type AttemptResult =
  | { ok: true; output: AssessmentOutput; usage: { input: number; output: number } }
  | { ok: false; kind: "file_rejected"; detail: string }
  | { ok: false; kind: "malformed"; detail: string };

/**
 * One or two /chat/completions calls (the built-in "retry once on malformed
 * output" behaviour). A file/image rejection is NOT treated as malformed
 * output — it is returned immediately so the caller can retry without files.
 */
async function tryAssessment(
  apiKey: string,
  model: string,
  content: OpenAIContentPart[],
): Promise<AttemptResult> {
  let lastError = "unknown";
  // Whether THIS call actually included a file/image part — a file-rejection
  // verdict only makes sense if there was a file to reject. Without this
  // guard, a candidate with no files (or all "unavailable") who happens to
  // hit an unrelated error whose message mentions "file"/"image" would be
  // routed into the file-rejection retry: an identical request gets sent
  // again, fails the same way, and a genuine API error gets mislabelled as
  // AssessmentFormatError — plus one wasted paid call.
  const hasFileParts = content.some((p) => p.type === "file" || p.type === "image_url");

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "submit_assessment" } },
      }),
    });
    const data = await res.json();

    if (data.error) {
      const message = stringifyApiError(data.error);
      if (hasFileParts && isFileContentRejection(message)) {
        return { ok: false, kind: "file_rejected", detail: message };
      }
      // Any other API error is not "malformed output" — surface it as-is,
      // matching the old behaviour where the Anthropic SDK threw immediately.
      throw new Error(`OpenAI: ${message}`);
    }

    const msg = data.choices?.[0]?.message;
    const call = msg?.tool_calls?.[0];
    if (!call || call.function?.name !== "submit_assessment") {
      lastError = "ไม่มี tool_call submit_assessment ในคำตอบ";
      continue;
    }

    let args: unknown;
    try {
      args = JSON.parse(call.function.arguments || "{}");
    } catch {
      lastError = "arguments ไม่ใช่ JSON ที่ถูกต้อง";
      continue;
    }

    const parsed = assessmentSchema.safeParse(args);
    if (!parsed.success) {
      lastError = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      continue;
    }

    return {
      ok: true,
      output: parsed.data,
      usage: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  return { ok: false, kind: "malformed", detail: lastError };
}

/**
 * Sources for files that were actually sent as file/image content parts this
 * call — the ones that can plausibly have been rejected. Mutates evidence.sources
 * IN PLACE (same array/objects the caller already holds) so callers that read
 * evidence.sources after runAssessment returns (see qualifier/index.ts) see the
 * corrected, honest picture without needing a different return shape.
 */
function markFileSourcesUnavailable(evidence: EvidenceBundle): void {
  const sentLabels = new Set(
    evidence.files
      .filter((f) => f.kind !== "unavailable" && f.base64 && f.mediaType)
      .map((f) => f.label),
  );
  for (const source of evidence.sources) {
    if (!sentLabels.has(source.label)) continue;
    source.status = "unavailable";
    source.detail = "โมเดล AI ไม่สามารถอ่านไฟล์นี้ได้ (ไฟล์ถูกปฏิเสธ) — ประเมินโดยไม่ใช้ไฟล์นี้";
  }
}

/**
 * One OpenAI call (plus its built-in malformed-output retry). If the API
 * rejects a file/image content part, retries ONCE more with the files omitted
 * entirely and marks the affected sources unavailable — never silently scores
 * the candidate as though the resume had been read.
 */
export async function runAssessment(
  evidence: EvidenceBundle,
  rubric: ResolvedRubric,
): Promise<{ output: AssessmentOutput; usage: { input: number; output: number }; model: string }> {
  const { apiKey, model } = await resolveOpenAiConfig();

  const result = await tryAssessment(apiKey, model, buildContentBlocks(evidence, rubric));
  if (result.ok) return { output: result.output, usage: result.usage, model };

  if (result.kind === "malformed") {
    throw new AssessmentFormatError(result.detail);
  }

  // file_rejected — retry once, text-only.
  markFileSourcesUnavailable(evidence);
  const retried = await tryAssessment(
    apiKey, model,
    buildContentBlocks(evidence, rubric, { omitFiles: true }),
  );
  if (retried.ok) return { output: retried.output, usage: retried.usage, model };

  const detail = retried.kind === "file_rejected"
    ? `โมเดลปฏิเสธคำขอซ้ำแม้ตัดไฟล์ออกแล้ว: ${retried.detail}`
    : retried.detail;
  throw new AssessmentFormatError(detail);
}
