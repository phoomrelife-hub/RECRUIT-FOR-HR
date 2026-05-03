import { db } from "@/lib/db";

export async function buildSystemPrompt(): Promise<string> {
  const versions = await db.aiPromptVersion.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { version: "desc" },
    take: 1,
  });

  if (versions.length > 0) return versions[0].content;

  const persona = await db.aiPersona.findFirst();
  const faqs = await db.aiFaq.findMany({ where: { isActive: true }, take: 20 });
  const guardrails = await db.aiGuardrail.findMany({ where: { isActive: true } });

  const name = persona?.botName ?? "Daniel";
  const tone = persona?.tone ?? "professional";

  let prompt = `คุณคือ ${name} ผู้ช่วย HR Bot ของ Relife\n`;
  prompt += `โทน: ${tone}\n`;

  if (persona?.greeting) prompt += `คำทักทาย: ${persona.greeting}\n`;

  if (faqs.length > 0) {
    prompt += "\n## คำถาม-ตอบที่พบบ่อย\n";
    faqs.forEach((f) => {
      prompt += `Q: ${f.question}\nA: ${f.answer}\n\n`;
    });
  }

  if (guardrails.length > 0) {
    prompt += "\n## กฎที่ต้องปฏิบัติตาม\n";
    guardrails.forEach((g) => {
      prompt += `- [${g.type}] ${g.description}${g.value ? `: ${g.value}` : ""}\n`;
    });
  }

  return prompt;
}

export async function getNextPromptVersion(): Promise<number> {
  const latest = await db.aiPromptVersion.findFirst({
    orderBy: { version: "desc" },
  });
  return (latest?.version ?? 0) + 1;
}
