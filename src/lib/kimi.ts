export type AiProviderName =
  | "qwen"
  | "openrouter"
  | "openai"
  | "groq"
  | "together"
  | "mistral"
  | "gemini"
  | "kimi";

export type KimiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiProviderConfig = {
  provider: AiProviderName;
  model: string;
  apiKey: string;
};

// All providers use OpenAI-compatible /chat/completions format
export const ENDPOINTS: Record<AiProviderName, string> = {
  qwen: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  together: "https://api.together.xyz/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  kimi: "https://api.moonshot.cn/v1/chat/completions",
};

export const DEFAULT_MODELS: Record<AiProviderName, string> = {
  qwen: "qwen-plus",
  openrouter: "openai/gpt-4o-mini",
  openai: "gpt-4o-mini",
  groq: "llama-3.1-8b-instant",
  together: "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
  mistral: "mistral-small-latest",
  gemini: "gemini-2.0-flash",
  kimi: "moonshot-v1-8k",
};

export async function askAI(messages: KimiMessage[], config: AiProviderConfig): Promise<string> {
  const endpoint = ENDPOINTS[config.provider];
  if (!endpoint) throw new Error(`Unknown provider: ${config.provider}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  // OpenRouter requires extra headers
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = process.env.NEXTAUTH_URL ?? "https://recruit-for-hr.vercel.app";
    headers["X-Title"] = "Relife Recruit Bot";
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error (${config.provider}/${config.model}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Backward-compat wrapper — reads from env as fallback
export async function askKimi(messages: KimiMessage[]): Promise<string> {
  const apiKey = process.env.QWEN_API_KEY ?? "";
  if (!apiKey) throw new Error("QWEN_API_KEY is not set");
  return askAI(messages, { provider: "qwen", model: DEFAULT_MODELS.qwen, apiKey });
}
