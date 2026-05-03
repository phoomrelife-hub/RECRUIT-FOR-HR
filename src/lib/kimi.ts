export type AiProviderName = "qwen" | "openrouter";

export type KimiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiProviderConfig = {
  provider: AiProviderName;
  model: string;
  apiKey: string;
};

const ENDPOINTS: Record<AiProviderName, string> = {
  qwen: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

const DEFAULT_MODELS: Record<AiProviderName, string> = {
  qwen: "qwen-plus",
  openrouter: "openai/gpt-4o-mini",
};

export async function askAI(messages: KimiMessage[], config: AiProviderConfig): Promise<string> {
  const endpoint = ENDPOINTS[config.provider];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://recruit-for-hr.vercel.app";
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

export { DEFAULT_MODELS };
