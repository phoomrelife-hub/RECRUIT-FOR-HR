// Server-side OpenAI tool-calling loop for the recruit AI Assistant.
// Ported from ads-dashboard lib/agents/providers.ts (openaiTurn), read-only tools only.
import { TOOLS, READ_TOOLS, runReadTool } from "./tools";
import { getAssistantConfig } from "./config";

const MAX_ITERATIONS = 6;
const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function runAssistantTurn(
  history: ChatTurn[],
): Promise<{ text: string; usage: { promptTokens: number; outputTokens: number } }> {
  const { apiKey, model, systemPrompt } = await getAssistantConfig();
  if (!apiKey) throw new Error("NO_API_KEY");

  const tools = TOOLS.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  let finalText = "";
  let promptTokens = 0;
  let outputTokens = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, tools, tool_choice: "auto" }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`OpenAI: ${data.error.message}`);

    if (data.usage) {
      promptTokens += data.usage.prompt_tokens || 0;
      outputTokens += data.usage.completion_tokens || 0;
    }

    const msg = data.choices?.[0]?.message;
    if (!msg) break;
    if (msg.content) finalText += msg.content;

    const calls = msg.tool_calls || [];
    if (calls.length === 0) break;

    messages.push(msg); // echo assistant tool_calls turn

    for (const c of calls) {
      const name = c.function?.name;
      let cArgs: Record<string, any> = {};
      try { cArgs = JSON.parse(c.function?.arguments || "{}"); } catch { /* ignore */ }

      if (READ_TOOLS.has(name)) {
        try {
          const out = await runReadTool(name, cArgs);
          messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(out) });
        } catch (e: any) {
          messages.push({ role: "tool", tool_call_id: c.id, content: `Error: ${e.message}` });
        }
      } else {
        messages.push({ role: "tool", tool_call_id: c.id, content: `Error: unknown tool ${name}` });
      }
    }
  }

  return { text: finalText.trim(), usage: { promptTokens, outputTokens } };
}
