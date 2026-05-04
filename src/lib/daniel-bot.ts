import { db } from "./db";
import {
  askOpenClaw,
  getOpenClawReply,
  type OpenClawMessage,
  type OpenClawReply,
  testOpenClawConnection,
} from "./openclaw-ai";
import { askAI, type AiProviderConfig, type KimiMessage, DEFAULT_MODELS } from "./kimi";

const FALLBACK_PROMPT = `คุณคือ Daniel ผู้ช่วย HR อัจฉริยะของบริษัท Relife
หน้าที่ของคุณคือคัดกรองผู้สมัครงานเบื้องต้นผ่าน LINE
ตอบเป็นภาษาไทย กระชับ สุภาพ และเป็นมิตร
ถามข้อมูลที่จำเป็น: ตำแหน่งที่สนใจ, ชื่อ-อายุ, ประสบการณ์, เงินเดือนที่ต้องการ, วันเริ่มงาน
ห้ามให้ข้อมูลเงินเดือน หรือตัดสินใจรับสมัครแทน HR`;

async function loadSettings(): Promise<Record<string, string>> {
  const settings = await db.setting.findMany({
    where: { key: { startsWith: "ai.prompt." } },
  });
  const config: Record<string, string> = {};
  for (const s of settings) config[s.key.replace("ai.prompt.", "")] = s.value;
  return config;
}

async function getSystemPrompt(config: Record<string, string>): Promise<string> {
  if (config.active === "false") return "";

  const sections = [
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

  const parts = sections
    .map(({ key, label }) => {
      const val = (config[key] ?? "").trim();
      return val ? `## ${label}\n${val}` : null;
    })
    .filter(Boolean);

  return parts.length > 0 ? parts.join("\n\n") : FALLBACK_PROMPT;
}

function getProviderConfig(config: Record<string, string>): AiProviderConfig | null {
  const provider = (config.provider_name ?? "qwen") as "qwen" | "openrouter";
  const model = config.provider_model || DEFAULT_MODELS[provider];

  // API key: DB first, then env fallback
  const apiKey =
    config.provider_api_key ||
    (provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.QWEN_API_KEY) ||
    "";

  if (!apiKey) return null;
  return { provider, model, apiKey };
}

type ConversationMessage = { role: "user" | "assistant"; content: string };

/**
 * PRIMARY: Get reply from OpenClaw (main AI)
 * FALLBACK: Use Kimi/Qwen if OpenClaw fails
 */
export async function getDanielReply(
  _candidateMsgCount: number,
  recentMessages: ConversationMessage[]
): Promise<string | null> {
  try {
    // === PRIMARY: Try OpenClaw first ===
    const openClawReply = await askOpenClaw(recentMessages as OpenClawMessage[]);
    if (openClawReply) {
      return openClawReply;
    }

    // === FALLBACK: Use Kimi/Qwen ===
    console.log("[Daniel Bot] OpenClaw failed, falling back to Kimi/Qwen");
    
    const config = await loadSettings();
    const systemPrompt = await getSystemPrompt(config);
    if (!systemPrompt) return null;

    const providerConfig = getProviderConfig(config);
    if (!providerConfig) return null;

    const messages: KimiMessage[] = [
      { role: "system", content: systemPrompt },
      ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    return await askAI(messages, providerConfig);
  } catch {
    return null;
  }
}

/**
 * Get reply with full context (for webhook handler)
 * Uses OpenClaw as primary, with full candidate context
 */
export async function getDanielReplyWithContext(params: {
  conversationId: string;
  candidateId: string;
  message: string;
  channel: string;
  context?: {
    candidateName?: string | null;
    position?: string | null;
    status?: string;
  };
  recentMessages?: ConversationMessage[];
}): Promise<OpenClawReply | null> {
  // === PRIMARY: OpenClaw ===
  const openClawResult = await getOpenClawReply(params);
  if (openClawResult?.reply) {
    return openClawResult;
  }

  // === FALLBACK: Kimi/Qwen ===
  console.log("[Daniel Bot] OpenClaw failed, falling back to Kimi/Qwen");
  
  const fallbackReply = await getDanielReply(0, params.recentMessages ?? []);
  if (!fallbackReply) return null;

  return {
    reply: fallbackReply,
    confidence: 0.6,
  };
}

/**
 * Check if OpenClaw is connected
 */
export async function isOpenClawReady(): Promise<boolean> {
  const result = await testOpenClawConnection();
  return result.ok;
}

export { testOpenClawConnection, getOpenClawReply };
