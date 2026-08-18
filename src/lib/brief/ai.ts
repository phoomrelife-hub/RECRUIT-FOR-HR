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

/**
 * Per-provider default model for this pipeline.
 *
 * Overrides lib/kimi.ts DEFAULT_MODELS, which still points Gemini at
 * `gemini-2.0-flash` for the chat bot. Verified present on the account's
 * ListModels response, 2026-08-18.
 */
const DEFAULT_MODEL_FOR: Partial<Record<AiProviderName, string>> = {
  gemini: "gemini-3.7-flash",
};

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

  const model = modelRaw || DEFAULT_MODEL_FOR[provider] || DEFAULT_MODELS[provider];

  const dbKey = await getSetting(`${provider}.api_key`);
  const apiKey = dbKey || process.env[`${provider.toUpperCase()}_API_KEY`] || "";
  if (!apiKey) throw new AiNotConfiguredError(provider);

  return { provider, model, apiKey };
}

/**
 * Statuses worth trying again.
 *
 * 503 "This model is currently experiencing high demand" is routine on
 * flash-tier models and was hit within the first ten calls of testing. Without
 * a retry, a 500-candidate run would record those as permanent failures and
 * quietly leave people unscored — the kind of gap nobody notices because the
 * run still reports success.
 */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const body = JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: maxTokens,
      // Gemini 3.x are THINKING models: reasoning tokens are billed as output
      // and spend the max_tokens budget before a single character of the answer
      // is written. Left at the default, a brief parse burns ~600 tokens
      // thinking and then reports finish_reason "length". "low" is plenty for
      // structured extraction — measured 7 completion tokens for a field the
      // default spent hundreds on. Providers that do not know the parameter
      // ignore it.
    reasoning_effort: "low",
    response_format: { type: "json_object" },
  });

  let res: Response | null = null;
  let lastDetail = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    res = await fetch(ENDPOINTS[config.provider], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body,
    });
    if (res.ok) break;

    lastDetail = await res.text();
    if (!RETRYABLE.has(res.status) || attempt === MAX_ATTEMPTS) {
      throw new Error(
        `AI API error (${config.provider}/${config.model}): ${lastDetail.slice(0, 400)}`,
      );
    }
    // 1s, then 3s. Long enough for a demand spike to pass, short enough that a
    // 500-candidate run does not stall for minutes on one bad patch.
    await sleep(attempt * 2000 - 1000);
  }

  if (!res || !res.ok) {
    throw new Error(`AI API error (${config.provider}/${config.model}): ${lastDetail.slice(0, 400)}`);
  }

  const json = await res.json();
  const choice = json.choices?.[0];

  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AiJsonError("ไม่มีเนื้อหาในคำตอบ");
  }

  // PARSE FIRST, judge finish_reason second.
  //
  // Gemini reports finish_reason "length" whenever THINKING exhausted the token
  // budget, even when the answer itself came back whole — a complete
  // {"filters":…,"criteria":[…]} arrives labelled as truncated. Rejecting on
  // the label alone threw away every valid response.
  //
  // So a successful parse wins outright, and "length" is only consulted to
  // explain a parse that actually failed. That is the one case where the
  // distinction matters: cut-off JSON and malformed JSON look identical
  // otherwise, and confusing them costs an hour.
  let data: T;
  try {
    data = JSON.parse(stripFences(content)) as T;
  } catch {
    if (choice?.finish_reason === "length") {
      throw new AiJsonError(`คำตอบถูกตัดกลางคัน (max_tokens=${maxTokens})`);
    }
    throw new AiJsonError(stripFences(content).slice(0, 200));
  }

  return {
    data,
    model: json.model ?? config.model,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  };
}
