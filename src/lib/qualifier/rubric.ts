import { db } from "@/lib/db";
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
