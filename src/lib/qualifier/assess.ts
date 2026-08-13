import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AssessmentOutput, EvidenceBundle, ResolvedRubric } from "./types";

export const QUALIFIER_MODEL = "claude-sonnet-5";
export const PROMPT_VERSION = "qualifier-v1";

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
    score: z.number().min(0).max(10).nullable(),
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

export function buildContentBlocks(
  evidence: EvidenceBundle,
  rubric: ResolvedRubric,
): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [
    { type: "text", text: buildPrompt(evidence, rubric) },
  ];

  for (const file of evidence.files) {
    if (file.kind === "unavailable" || !file.base64 || !file.mediaType) continue;

    blocks.push({ type: "text", text: `--- ไฟล์: ${file.label} ---` });

    if (file.kind === "pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: file.base64 },
      });
    } else {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: file.mediaType as "image/jpeg" | "image/png",
          data: file.base64,
        },
      });
    }
  }

  return blocks;
}

const TOOL: Anthropic.Tool = {
  name: "submit_assessment",
  description: "ส่งผลการประเมินผู้สมัครและคำถามสัมภาษณ์",
  input_schema: {
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
            score: { type: ["number", "null"], description: "0-10 หรือ null ถ้าไม่มีหลักฐาน" },
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
};

export class AssessmentFormatError extends Error {
  constructor(detail: string) {
    super(`AI ตอบกลับในรูปแบบที่ไม่ถูกต้อง: ${detail}`);
    this.name = "AssessmentFormatError";
  }
}

/** One Claude call. Retries once on a malformed response, then fails loudly. */
export async function runAssessment(
  evidence: EvidenceBundle,
  rubric: ResolvedRubric,
): Promise<{ output: AssessmentOutput; usage: { input: number; output: number } }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const content = buildContentBlocks(evidence, rubric);

  let lastError = "unknown";
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await anthropic.messages.create({
      model: QUALIFIER_MODEL,
      max_tokens: 4096,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "submit_assessment" },
      messages: [{ role: "user", content }],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      lastError = "ไม่มี tool_use ในคำตอบ";
      continue;
    }

    const parsed = assessmentSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      lastError = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      continue;
    }

    return {
      output: parsed.data,
      usage: {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
      },
    };
  }

  throw new AssessmentFormatError(lastError);
}
