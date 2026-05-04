import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ALLOWED_KEYS = [
  "objectives",
  "company_info",
  "conversation_flow",
  "response_guidelines",
  "faqs",
  "critical_rules",
  "position_info",
  "contact_info",
  "response_templates",
  "custom_instructions",
  "active",
  "provider_name",
  "provider_model",
  "provider_api_key",
  "persona_archetype",
];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await db.setting.findMany({
    where: { key: { in: ALLOWED_KEYS.map((k) => `ai.prompt.${k}`) } },
  });

  const config: Record<string, string> = {};
  for (const s of settings) {
    const key = s.key.replace("ai.prompt.", "");
    // mask API key — never return full key
    if (key === "provider_api_key" && s.value.length > 8) {
      config[key] = `${s.value.slice(0, 6)}${"*".repeat(s.value.length - 10)}${s.value.slice(-4)}`;
    } else {
      config[key] = s.value;
    }
  }
  return NextResponse.json(config);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session || !["SUPER_ADMIN", "HR_MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== "string" || !ALLOWED_KEYS.includes(key)) continue;
    // skip masked key placeholder — don't overwrite real key with masked value
    if (key === "provider_api_key" && value.includes("*")) continue;
    await db.setting.upsert({
      where: { key: `ai.prompt.${key}` },
      update: { value },
      create: { key: `ai.prompt.${key}`, value },
    });
  }
  return NextResponse.json({ ok: true });
}
