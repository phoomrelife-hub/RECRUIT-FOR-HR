import { db } from "@/lib/db";

export async function getAiOverview() {
  const [
    providers,
    promptVersions,
    personas,
    faqs,
    templates,
    guardrails,
    handoffRules,
    taggingRules,
    recentLogs,
  ] = await Promise.all([
    db.aiProvider.findMany({ orderBy: { createdAt: "asc" } }),
    db.aiPromptVersion.findMany({ orderBy: { version: "desc" }, take: 5 }),
    db.aiPersona.findFirst(),
    db.aiFaq.count({ where: { isActive: true } }),
    db.aiResponseTemplate.count({ where: { isActive: true } }),
    db.aiGuardrail.count({ where: { isActive: true } }),
    db.aiHandoffRule.count({ where: { isActive: true } }),
    db.aiTaggingRule.count({ where: { isActive: true } }),
    db.aiLog.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const activeProvider = providers.find((p) => p.isActive);
  const publishedPrompt = promptVersions.find((v) => v.status === "PUBLISHED");
  const totalTokens = await db.aiLog.aggregate({ _sum: { totalTokens: true } });
  const totalCost = await db.aiLog.aggregate({ _sum: { costEstimate: true } });

  return {
    activeProvider: activeProvider
      ? { id: activeProvider.id, name: activeProvider.name, displayName: activeProvider.displayName, defaultModel: activeProvider.defaultModel }
      : null,
    publishedPromptVersion: publishedPrompt
      ? { version: publishedPrompt.version, title: publishedPrompt.title, publishedAt: publishedPrompt.publishedAt }
      : null,
    persona: personas,
    stats: {
      activeFaqs: faqs,
      activeTemplates: templates,
      activeGuardrails: guardrails,
      activeHandoffRules: handoffRules,
      activeTaggingRules: taggingRules,
      totalTokensUsed: totalTokens._sum.totalTokens ?? 0,
      totalCostUsd: totalCost._sum.costEstimate ?? 0,
    },
    recentLogs: recentLogs.map((l) => ({
      id: l.id,
      action: l.action,
      model: l.model,
      totalTokens: l.totalTokens,
      costEstimate: l.costEstimate,
      success: l.success,
      createdAt: l.createdAt,
    })),
  };
}
