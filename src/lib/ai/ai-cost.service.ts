import { db } from "@/lib/db";

export async function getCostSummary() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [monthly, weekly, daily, limits] = await Promise.all([
    db.aiLog.aggregate({
      _sum: { costEstimate: true, totalTokens: true },
      where: { createdAt: { gte: startOfMonth } },
    }),
    db.aiLog.aggregate({
      _sum: { costEstimate: true, totalTokens: true },
      where: { createdAt: { gte: startOfWeek } },
    }),
    db.aiLog.aggregate({
      _sum: { costEstimate: true, totalTokens: true },
      where: { createdAt: { gte: startOfDay } },
    }),
    db.aiCostLimit.findMany({ where: { isActive: true } }),
  ]);

  const monthlyLimit = limits.find((l) => l.period === "monthly");
  const dailyLimit = limits.find((l) => l.period === "daily");

  const monthlyCost = monthly._sum.costEstimate ?? 0;
  const dailyCost = daily._sum.costEstimate ?? 0;

  return {
    daily: { cost: dailyCost, tokens: daily._sum.totalTokens ?? 0 },
    weekly: { cost: weekly._sum.costEstimate ?? 0, tokens: weekly._sum.totalTokens ?? 0 },
    monthly: { cost: monthlyCost, tokens: monthly._sum.totalTokens ?? 0 },
    limits: {
      monthly: monthlyLimit
        ? {
            limit: monthlyLimit.limitUsd,
            used: monthlyCost,
            percent: monthlyLimit.limitUsd > 0 ? (monthlyCost / monthlyLimit.limitUsd) * 100 : 0,
            alertAt: monthlyLimit.alertAt,
          }
        : null,
      daily: dailyLimit
        ? {
            limit: dailyLimit.limitUsd,
            used: dailyCost,
            percent: dailyLimit.limitUsd > 0 ? (dailyCost / dailyLimit.limitUsd) * 100 : 0,
            alertAt: dailyLimit.alertAt,
          }
        : null,
    },
  };
}

export async function upsertCostLimit(data: {
  period: string;
  limitUsd: number;
  alertAt?: number;
  isActive?: boolean;
}) {
  const existing = await db.aiCostLimit.findFirst({ where: { period: data.period } });
  if (existing) {
    return db.aiCostLimit.update({ where: { id: existing.id }, data });
  }
  return db.aiCostLimit.create({ data });
}
