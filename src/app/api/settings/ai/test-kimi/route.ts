import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { askAI, type AiProviderName, DEFAULT_MODELS } from "@/lib/kimi";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["SUPER_ADMIN", "HR_MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // load provider config from DB
  const settings = await db.setting.findMany({
    where: { key: { in: ["ai.prompt.provider_name", "ai.prompt.provider_model", "ai.prompt.provider_api_key"] } },
  });
  const cfg: Record<string, string> = {};
  for (const s of settings) cfg[s.key.replace("ai.prompt.", "")] = s.value;

  const provider = (cfg.provider_name ?? "qwen") as AiProviderName;
  const model = cfg.provider_model || DEFAULT_MODELS[provider];
  const apiKey =
    cfg.provider_api_key ||
    (provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.QWEN_API_KEY) ||
    "";

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: `API key not configured for provider "${provider}"` });
  }

  try {
    const reply = await askAI(
      [{ role: "user", content: "สวัสดี ตอบสั้นๆ ว่า OK" }],
      { provider, model, apiKey }
    );
    return NextResponse.json({
      ok: true,
      provider,
      model,
      reply,
      keyPreview: `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      provider,
      model,
      error: e instanceof Error ? e.message : String(e),
      keyPreview: `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`,
    });
  }
}
