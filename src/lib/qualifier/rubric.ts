import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { QUALIFIER_MODEL } from "./assess";
import type { RubricCriterion, ResolvedRubric } from "./types";

export class NoRubricError extends Error {
  constructor() {
    super("ยังไม่ได้ตั้งเกณฑ์การให้คะแนน (rubric) — กรุณาตั้งค่าก่อนใช้งาน AI Qualifier");
    this.name = "NoRubricError";
  }
}

export interface RubricRow {
  id: string;
  jobPositionId: string | null;
  isDraft: boolean;
  isActive: boolean;
  categories: RubricCriterion[];
}

const usable = (r: RubricRow) => !r.isDraft && r.isActive && r.categories.length > 0;

/**
 * Build the Prisma where clause for fetching rubrics.
 * Pure function so query construction is testable without a database.
 */
export function rubricWhere(jobPositionId: string | null) {
  if (jobPositionId) {
    // Fetch both global and position-specific rubrics.
    return { OR: [{ jobPositionId: null }, { jobPositionId }] };
  }
  // Fetch only global rubrics when candidate has no position.
  return { jobPositionId: null };
}

/** Pure precedence logic: approved position rubric → global default → null. */
export function selectRubric(
  configs: RubricRow[],
  jobPositionId: string | null,
): ResolvedRubric | null {
  const pool = configs.filter(usable);

  const forPosition = jobPositionId
    ? pool.find((r) => r.jobPositionId === jobPositionId)
    : undefined;
  const global = pool.find((r) => r.jobPositionId === null);

  const chosen = forPosition ?? global;
  if (!chosen) return null;

  return {
    configId: chosen.id,
    jobPositionId: chosen.jobPositionId,
    // Only a fallback if we WANTED a position rubric and didn't get one.
    isGlobalFallback: Boolean(jobPositionId) && chosen.jobPositionId === null,
    criteria: [...chosen.categories].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export async function resolveRubric(jobPositionId: string | null): Promise<ResolvedRubric> {
  const configs = await db.aiScoringConfig.findMany({
    where: rubricWhere(jobPositionId),
    include: { categories: { orderBy: { sortOrder: "asc" } } },
  });

  const rows: RubricRow[] = configs.map((c) => ({
    id: c.id,
    jobPositionId: c.jobPositionId,
    isDraft: c.isDraft,
    isActive: c.isActive,
    categories: c.categories.map((k) => ({
      name: k.name, weight: k.weight, description: k.description ?? "", sortOrder: k.sortOrder,
    })),
  }));

  const resolved = selectRubric(rows, jobPositionId);
  if (!resolved) throw new NoRubricError();
  return resolved;
}

/** Weights are meaningless unless they sum to 100 — the score maths assumes it. */
export function normaliseWeights(criteria: RubricCriterion[]): RubricCriterion[] {
  if (criteria.length === 0) return [];
  const total = criteria.reduce((s, c) => s + c.weight, 0);
  if (total === 0) {
    const even = Math.round(100 / criteria.length);
    return criteria.map((c) => ({ ...c, weight: even }));
  }
  if (total === 100) return criteria;
  return criteria.map((c) => ({ ...c, weight: Math.round((c.weight / total) * 100) }));
}

export const draftRubricSchema = z.object({
  criteria: z.array(z.object({
    name: z.string(),
    weight: z.number().min(0).max(100),
    description: z.string(),
  })).min(2).max(8),
});

export async function draftRubric(job: {
  title: string;
  description: string | null;
  requiredExperience: string | null;
}): Promise<RubricCriterion[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: QUALIFIER_MODEL,
    max_tokens: 1500,
    tools: [{
      name: "submit_rubric",
      description: "ส่งเกณฑ์การให้คะแนนผู้สมัคร",
      input_schema: {
        type: "object",
        properties: {
          criteria: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "ชื่อเกณฑ์ ภาษาไทย สั้น ๆ" },
                weight: { type: "number", description: "น้ำหนัก รวมทุกข้อต้องได้ 100" },
                description: { type: "string", description: "อธิบายว่าดูอะไร" },
              },
              required: ["name", "weight", "description"],
            },
          },
        },
        required: ["criteria"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_rubric" },
    messages: [{
      role: "user",
      content: `ร่างเกณฑ์การให้คะแนนผู้สมัครสำหรับตำแหน่งนี้ที่ Relife Solutions
(บริษัท E-Commerce สุขภาพและความงาม)

ตำแหน่ง: ${job.title}
รายละเอียด: ${job.description || "ไม่ได้ระบุ"}
ประสบการณ์ที่ต้องการ: ${job.requiredExperience || "ไม่ได้ระบุ"}

ให้ 4-6 เกณฑ์ น้ำหนักรวม 100
เกณฑ์ต้องประเมินได้จริงจากใบสมัครและ Resume เท่านั้น
ห้ามใส่เกณฑ์ที่ต้องสัมภาษณ์ก่อนถึงจะรู้`,
    }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("ร่างเกณฑ์ไม่สำเร็จ — AI ตอบกลับผิดรูปแบบ");
  }

  const parsed = draftRubricSchema.parse(toolUse.input);
  return normaliseWeights(
    parsed.criteria.map((c, i) => ({ ...c, sortOrder: i })),
  );
}
