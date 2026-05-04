import { db } from "./db";

const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || "http://localhost:18789";
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || "";

export interface OpenClawMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenClawReply {
  reply: string;
  confidence?: number;
  openclawId?: string;
  handoff?: boolean;
}

export interface OpenClawConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
}

/**
 * Load bot config from DB settings (bot.* keys)
 */
async function loadBotConfig(): Promise<OpenClawConfig> {
  const settings = await db.setting.findMany({
    where: { key: { startsWith: "bot." } },
  });

  const config: Record<string, string> = {};
  for (const s of settings) {
    config[s.key.replace("bot.", "")] = s.value;
  }

  return {
    model: config.model || undefined,
    temperature: config.temperature ? parseFloat(config.temperature) : undefined,
    max_tokens: config.max_tokens ? parseInt(config.max_tokens) : undefined,
    system_prompt: config.system_prompt || undefined,
  };
}

/**
 * Build system prompt from bot config sections
 */
async function buildSystemPrompt(): Promise<string> {
  const settings = await db.setting.findMany({
    where: { key: { startsWith: "ai.prompt." } },
  });

  const config: Record<string, string> = {};
  for (const s of settings) {
    config[s.key.replace("ai.prompt.", "")] = s.value;
  }

  if (config.active === "false") {
    return "";
  }

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

  return parts.length > 0 ? parts.join("\n\n") : getDefaultPrompt();
}

function getDefaultPrompt(): string {
  return `คุณคือ Daniel ผู้ช่วย HR อัจฉริยะของบริษัท Relife
หน้าที่ของคุณคือคัดกรองผู้สมัครงานเบื้องต้นผ่าน LINE
ตอบเป็นภาษาไทย กระชับ สุภาพ และเป็นมิตร
ถามข้อมูลที่จำเป็น: ตำแหน่งที่สนใจ, ชื่อ-อายุ, ประสบการณ์, เงินเดือนที่ต้องการ, วันเริ่มงาน
ห้ามให้ข้อมูลเงินเดือน หรือตัดสินใจรับสมัครแทน HR`;
}

/**
 * Send message to OpenClaw AI (primary AI for HR bot)
 */
export async function askOpenClaw(
  messages: OpenClawMessage[],
  config?: OpenClawConfig
): Promise<string | null> {
  try {
    const botConfig = config ?? (await loadBotConfig());
    const systemPrompt = botConfig.system_prompt ?? (await buildSystemPrompt());

    if (!systemPrompt) {
      return null;
    }

    // Build messages with system prompt
    const fullMessages: OpenClawMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const res = await fetch(`${OPENCLAW_API_URL}/api/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENCLAW_API_KEY}`,
      },
      body: JSON.stringify({
        model: botConfig.model || "default",
        messages: fullMessages,
        temperature: botConfig.temperature ?? 0.7,
        max_tokens: botConfig.max_tokens ?? 500,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenClaw AI error:", err);
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("OpenClaw AI request failed:", error);
    return null;
  }
}

/**
 * Send candidate message to OpenClaw and get reply
 * This is the MAIN function for HR bot - replaces Kimi fallback
 */
export async function getOpenClawReply(params: {
  conversationId: string;
  candidateId: string;
  message: string;
  channel: string;
  context?: {
    candidateName?: string | null;
    position?: string | null;
    status?: string;
  };
  recentMessages?: { role: "user" | "assistant"; content: string }[];
}): Promise<OpenClawReply | null> {
  try {
    const { conversationId, candidateId, message, channel, context, recentMessages } = params;

    // Try webhook endpoint first (if OpenClaw has recruit-specific endpoint)
    const webhookRes = await fetch(`${OPENCLAW_API_URL}/api/webhook/recruit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENCLAW_API_KEY}`,
      },
      body: JSON.stringify({
        conversationId,
        candidateId,
        message,
        channel,
        context,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (webhookRes.ok) {
      const data = await webhookRes.json();
      if (data.reply) {
        return {
          reply: data.reply,
          confidence: data.confidence,
          openclawId: data.openclawId,
          handoff: data.handoff,
        };
      }
    }

    // Fallback: use chat completions directly
    const messages: OpenClawMessage[] = [
      ...(recentMessages?.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })) ?? []),
      { role: "user", content: message },
    ];

    const reply = await askOpenClaw(messages);
    if (!reply) return null;

    return {
      reply,
      confidence: 0.8,
    };
  } catch (error) {
    console.error("OpenClaw reply failed:", error);
    return null;
  }
}

/**
 * Test OpenClaw connection
 */
export async function testOpenClawConnection(): Promise<{
  ok: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${OPENCLAW_API_URL}/api/health`, {
      headers: { Authorization: `Bearer ${OPENCLAW_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { ok: true, version: data.version };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Connection failed",
    };
  }
}

/**
 * Get available models from OpenClaw
 */
export async function getOpenClawModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OPENCLAW_API_URL}/api/models`, {
      headers: { Authorization: `Bearer ${OPENCLAW_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    return data.models ?? [];
  } catch {
    return [];
  }
}
