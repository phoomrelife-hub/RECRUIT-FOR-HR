import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { askAI, type AiProviderName, type KimiMessage, DEFAULT_MODELS } from "@/lib/kimi";
import { NextResponse } from "next/server";

const SECTIONS = [
  { key: "objectives", label: "เป้าหมายหลัก" },
  { key: "company_info", label: "ข้อมูลบริษัท" },
  { key: "conversation_flow", label: "ลำดับการสนทนา" },
  { key: "response_guidelines", label: "แนวทางการตอบ" },
  { key: "faqs", label: "คำถามที่พบบ่อย" },
  { key: "critical_rules", label: "กฎสำคัญ" },
  { key: "position_info", label: "ข้อมูลตำแหน่งงาน" },
  { key: "contact_info", label: "ข้อมูลติดต่อ HR" },
  { key: "response_templates", label: "Template การตอบ" },
  { key: "custom_instructions", label: "คำสั่งเพิ่มเติม" },
];

const FALLBACK_PROMPT = `คุณคือ Daniel ผู้ช่วย HR อัจฉริยะของบริษัท Relife
หน้าที่ของคุณคือคัดกรองผู้สมัครงานเบื้องต้นผ่าน LINE
ตอบเป็นภาษาไทย กระชับ สุภาพ และเป็นมิตร`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !["SUPER_ADMIN", "HR_MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { messages } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  // load prompt config from DB
  const settings = await db.setting.findMany({
    where: { key: { startsWith: "ai.prompt." } },
  });
  const cfg: Record<string, string> = {};
  for (const s of settings) cfg[s.key.replace("ai.prompt.", "")] = s.value;

  if (cfg.active === "false") {
    return NextResponse.json({ error: "Bot is currently inactive" }, { status: 400 });
  }

  // build system prompt
  const parts = SECTIONS.map(({ key, label }) => {
    const val = (cfg[key] ?? "").trim();
    return val ? `## ${label}\n${val}` : null;
  }).filter(Boolean);
  const systemPrompt = parts.length > 0 ? parts.join("\n\n") : FALLBACK_PROMPT;

  // load persona greeting
  const persona = await db.aiPersona.findFirst();
  const fullPrompt = persona?.greeting
    ? `${systemPrompt}\n\n## คำทักทาย\n${persona.greeting}`
    : systemPrompt;

  // load provider config
  const provider = (cfg.provider_name ?? "qwen") as AiProviderName;
  const model = cfg.provider_model || DEFAULT_MODELS[provider];
  const apiKey =
    cfg.provider_api_key ||
    (provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.QWEN_API_KEY) ||
    "";

  if (!apiKey) {
    return NextResponse.json({ error: "AI provider not configured — กรุณาตั้งค่า API Key ใน Bot Prompt tab" }, { status: 400 });
  }

  const kimiMessages: KimiMessage[] = [
    { role: "system", content: fullPrompt },
    ...messages,
  ];

  try {
    const reply = await askAI(kimiMessages, { provider, model, apiKey });
    return NextResponse.json({ reply, provider, model });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI call failed" },
      { status: 500 }
    );
  }
}
