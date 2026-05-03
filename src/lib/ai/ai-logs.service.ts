import { db } from "@/lib/db";

export interface AiLogFilter {
  action?: string;
  success?: boolean;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export async function listAiLogs(filter: AiLogFilter = {}) {
  const { action, success, from, to, page = 1, limit = 50 } = filter;

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (success !== undefined) where.success = success;
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, unknown>).gte = from;
    if (to) (where.createdAt as Record<string, unknown>).lte = to;
  }

  const [logs, total] = await Promise.all([
    db.aiLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.aiLog.count({ where }),
  ]);

  return { logs, total, page, limit };
}

export async function createAiLog(data: {
  providerId?: string;
  model?: string;
  action: string;
  candidateId?: string;
  promptTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costEstimate?: number;
  latencyMs?: number;
  success?: boolean;
  errorMessage?: string;
}) {
  return db.aiLog.create({ data });
}

export async function getAiLogStats() {
  const [total, errors, tokenSum, costSum] = await Promise.all([
    db.aiLog.count(),
    db.aiLog.count({ where: { success: false } }),
    db.aiLog.aggregate({ _sum: { totalTokens: true } }),
    db.aiLog.aggregate({ _sum: { costEstimate: true } }),
  ]);

  const byAction = await db.aiLog.groupBy({
    by: ["action"],
    _count: { _all: true },
    _sum: { totalTokens: true, costEstimate: true },
  });

  return {
    total,
    errors,
    successRate: total > 0 ? ((total - errors) / total) * 100 : 100,
    totalTokens: tokenSum._sum.totalTokens ?? 0,
    totalCostUsd: costSum._sum.costEstimate ?? 0,
    byAction: byAction.map((b) => ({
      action: b.action,
      count: b._count._all,
      tokens: b._sum.totalTokens ?? 0,
      cost: b._sum.costEstimate ?? 0,
    })),
  };
}
