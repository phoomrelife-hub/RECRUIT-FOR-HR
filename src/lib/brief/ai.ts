import { db } from "@/lib/db";
import { ENDPOINTS, DEFAULT_MODELS, type AiProviderName } from "@/lib/kimi";

/**
 * Deterministic JSON calls for the matching pipeline.
 *
 * Deliberately NOT `askAI()` from lib/kimi.ts. That helper hardcodes
 * `temperature: 0.7` and `max_tokens: 500`, which are right for a chat reply to
 * a candidate and wrong here in two ways:
 *
 *   - 0.7 makes the same candidate score differently on consecutive runs. HR
 *     re-opening a list and seeing new numbers destroys trust in the ranking,
 *     and it makes the (candidateId, briefHash) cache meaningless.
 *   - 500 tokens silently truncates a multi-criterion judgement mid-JSON, which
 *     surfaces as a parse error rather than as "the answer was cut off".
 *
 * Every provider in ENDPOINTS speaks the OpenAI /chat/completions shape,
 * including Gemini via its OpenAI-compatibility layer, so switching provider is
 * configuration rather than code.
 */

export const DEFAULT_PROVIDER: AiProviderName = "gemini";

export class AiNotConfiguredError extends Error {
  constructor(provider: string) {
    super(
      `ยังไม่ได้ตั้งค่า API key สำหรับ ${provider} — ใส่ที่หน้าตั้งค่า AI หรือ env ${provider.toUpperCase()}_API_KEY`,
    );
    this.name = "AiNotConfiguredError";
  }
}

export class AiJsonError extends Error {
  constructor(detail: string) {
    super(`AI ตอบกลับในรูปแบบที่อ่านไม่ได้: ${detail}`);
    this.name = "AiJsonError";
  }
}

export interface AiConfig {
  provider: AiProviderName;
  model: string;
  apiKey: string;
}

async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/**
 * Resolve provider/model/key: database Setting first, environment second.
 *
 * The DB wins so the provider can be switched from the settings UI without a
 * redeploy — which is the whole point while the OpenAI account is out of credit
 * and Gemini is standing in for it.
 */
export async function resolveAiConfig(): Promise<AiConfig> {
  const [providerRaw, modelRaw] = await Promise.all([
    getSetting("ai.provider"),
    getSetting("ai.model"),
  ]);

  const provider = (providerRaw as AiProviderName) || DEFAULT_PROVIDER;
  if (!ENDPOINTS[provider]) throw new AiNotConfiguredError(provider);

  const model = modelRaw || DEFAULT_MODELS[provider];

  const dbKey = await getSetting(`${provider}.api_key`);
  const apiKey = dbKey || process.env[`${provider.toUpperCase()}_API_KEY`] || "";
  if (!apiKey) throw new AiNotConfiguredError(provider);

  return { provider, model, apiKey };
}

/** Strip ```json fences some models add despite response_format. */
function stripFences(text: string): string {
  const t = text.trim();
  if (!t.startsWith("```")) return t;
  return t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

export interface JsonCallResult<T> {
  data: T;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

/**
 * One chat/completions call that must come back as a JSON object.
 *
 * `temperature: 0` and an explicit large `max_tokens` are the two things this
 * exists to guarantee.
 */
export async function callJson<T>(
  config: AiConfig,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4000,
): Promise<JsonCallResult<T>> {
  const res = await fetch(ENDPOINTS[config.provider], {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`AI API error (${config.provider}/${config.model}): ${detail.slice(0, 400)}`);
  }

  const json = await res.json();
  const choice = json.choices?.[0];

  // A truncated response is a different bug from a malformed one, and saying so
  // saves an hour of staring at invalid JSON that was actually valid-but-cut.
  if (choice?.finish_reason === "length") {
    throw new AiJsonError(`คำตอบถูกตัดกลางคัน (max_tokens=${maxTokens})`);
  }

  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AiJsonError("ไม่มีเนื้อหาในคำตอบ");
  }

  let data: T;
  try {
    data = JSON.parse(stripFences(content)) as T;
  } catch {
    throw new AiJsonError(stripFences(content).slice(0, 200));
  }

  return {
    data,
    model: json.model ?? config.model,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  };
}
