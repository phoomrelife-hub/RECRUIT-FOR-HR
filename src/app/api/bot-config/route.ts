import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ALLOWED_KEYS = [
  "objectives", "company_info", "conversation_flow", "response_guidelines",
  "open_positions", "critical_rules", "contact_info", "custom_instructions", "active",
];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await db.setting.findMany({
    where: { key: { in: ALLOWED_KEYS.map((k) => `bot.${k}`) } },
  });

  const config: Record<string, string> = {};
  for (const s of settings) config[s.key.replace("bot.", "")] = s.value;
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
    await db.setting.upsert({
      where: { key: `bot.${key}` },
      update: { value },
      create: { key: `bot.${key}`, value },
    });
  }
  return NextResponse.json({ ok: true });
}
