// Qwen (Alibaba DashScope) — OpenAI-compatible API
// Get key at: dashscope.aliyun.com → API Keys
const QWEN_API = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";
const QWEN_MODEL = "qwen-plus";

export type KimiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function askKimi(messages: KimiMessage[]): Promise<string> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) throw new Error("QWEN_API_KEY is not set");

  const res = await fetch(QWEN_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Qwen API error: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
