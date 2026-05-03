import { db } from "@/lib/db";
import { runMockAi } from "./ai-mock.service";

export interface PlaygroundRunInput {
  systemPrompt: string;
  messages: { role: string; content: string }[];
  providerId?: string;
  model?: string;
  saveName?: string;
  createdById?: string;
}

export async function runPlayground(input: PlaygroundRunInput) {
  const start = Date.now();
  const result = runMockAi(input.messages, input.systemPrompt);
  const latencyMs = Date.now() - start + result.latencyMs;

  const allMessages = [
    ...input.messages,
    { role: "assistant", content: result.content },
  ];

  return {
    content: result.content,
    extractedFields: result.extractedFields,
    tags: result.tags,
    score: result.score,
    handoff: result.handoff,
    tokenEstimate: result.tokenEstimate,
    costEstimate: result.costEstimate,
    latencyMs,
    messages: allMessages,
  };
}

export async function savePlaygroundRun(input: PlaygroundRunInput & {
  responseContent: string;
  tokenEstimate: number;
  costEstimate: number;
  latencyMs: number;
}) {
  const run = await db.aiPlaygroundTestRun.create({
    data: {
      name: input.saveName ?? `Test ${new Date().toLocaleString("th-TH")}`,
      providerId: input.providerId,
      model: input.model,
      systemPrompt: input.systemPrompt,
      totalTokens: input.tokenEstimate,
      totalCost: input.costEstimate,
      latencyMs: input.latencyMs,
      createdById: input.createdById,
      messages: {
        create: [
          ...input.messages.map((m, i) => ({
            role: m.role,
            content: m.content,
            sortOrder: i,
          })),
          {
            role: "assistant",
            content: input.responseContent,
            sortOrder: input.messages.length,
          },
        ],
      },
    },
    include: { messages: { orderBy: { sortOrder: "asc" } } },
  });
  return run;
}

export async function listPlaygroundRuns(limit = 20) {
  return db.aiPlaygroundTestRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { messages: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
}

export async function getPlaygroundRun(id: string) {
  return db.aiPlaygroundTestRun.findUnique({
    where: { id },
    include: { messages: { orderBy: { sortOrder: "asc" } } },
  });
}
