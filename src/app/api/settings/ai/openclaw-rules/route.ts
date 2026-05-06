import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const RULE_KEYS = [
  "openclaw.rules.active",
  "openclaw.rules.bot_name",
  "openclaw.rules.tone",
  "openclaw.rules.language",
  "openclaw.rules.objectives",
  "openclaw.rules.identity",
  "openclaw.rules.critical_rules",
  "openclaw.rules.conversation_flow",
  "openclaw.rules.positions",
  "openclaw.rules.contact",
  "openclaw.rules.faqs",
  "openclaw.rules.response_templates",
] as const;

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.setting.findMany({
    where: { key: { in: [...RULE_KEYS] } },
  });

  const saved: Record<string, string> = {};
  for (const r of rows) saved[r.key] = r.value;

  return NextResponse.json({
    active: saved["openclaw.rules.active"] ?? "false",
    bot_name: saved["openclaw.rules.bot_name"] ?? "",
    tone: saved["openclaw.rules.tone"] ?? "Friendly",
    language: saved["openclaw.rules.language"] ?? "thai_english",
    objectives: saved["openclaw.rules.objectives"] ?? "",
    identity: saved["openclaw.rules.identity"] ?? "",
    critical_rules: saved["openclaw.rules.critical_rules"] ?? "",
    conversation_flow: saved["openclaw.rules.conversation_flow"] ?? "",
    positions: saved["openclaw.rules.positions"] ?? "",
    contact: saved["openclaw.rules.contact"] ?? "",
    faqs: saved["openclaw.rules.faqs"] ?? "",
    response_templates: saved["openclaw.rules.response_templates"] ?? "",
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const updates: Record<string, string> = {
    "openclaw.rules.active": body.active === true || body.active === "true" ? "true" : "false",
    "openclaw.rules.bot_name": String(body.bot_name ?? ""),
    "openclaw.rules.tone": String(body.tone ?? "Friendly"),
    "openclaw.rules.language": String(body.language ?? "thai_english"),
    "openclaw.rules.objectives": String(body.objectives ?? ""),
    "openclaw.rules.identity": String(body.identity ?? ""),
    "openclaw.rules.critical_rules": String(body.critical_rules ?? ""),
    "openclaw.rules.conversation_flow": String(body.conversation_flow ?? ""),
    "openclaw.rules.positions": String(body.positions ?? ""),
    "openclaw.rules.contact": String(body.contact ?? ""),
    "openclaw.rules.faqs": String(body.faqs ?? ""),
    "openclaw.rules.response_templates": String(body.response_templates ?? ""),
  };

  await Promise.all(
    Object.entries(updates).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
