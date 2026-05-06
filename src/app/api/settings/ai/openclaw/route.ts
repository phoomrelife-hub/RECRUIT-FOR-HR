import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || "http://localhost:18789";

const DEFAULTS = {
  enabled: true,
  model: "default",
  temperature: 0.7,
  max_tokens: 500,
  system_prompt: "",
};

async function testOpenClawConnection() {
  try {
    const res = await fetch(`${OPENCLAW_API_URL}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, version: data.version };
    }
    return { ok: false, error: `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: "ไม่สามารถเชื่อมต่อได้ — ตรวจสอบว่า OpenClaw กำลังทำงานอยู่" };
  }
}

async function getAvailableModels() {
  try {
    const res = await fetch(`${OPENCLAW_API_URL}/api/models`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return Array.isArray(data.models) ? data.models : [];
    }
  } catch {}
  return [];
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.setting.findMany({
    where: { key: { startsWith: "openclaw." } },
  });

  const saved: Record<string, string> = {};
  for (const r of rows) saved[r.key.replace("openclaw.", "")] = r.value;

  const config = {
    enabled: saved.enabled !== undefined ? saved.enabled === "true" : DEFAULTS.enabled,
    model: saved.model ?? DEFAULTS.model,
    temperature: saved.temperature !== undefined ? parseFloat(saved.temperature) : DEFAULTS.temperature,
    max_tokens: saved.max_tokens !== undefined ? parseInt(saved.max_tokens) : DEFAULTS.max_tokens,
    system_prompt: saved.system_prompt ?? DEFAULTS.system_prompt,
  };

  const [connection, availableModels] = await Promise.all([
    testOpenClawConnection(),
    getAvailableModels(),
  ]);

  return NextResponse.json({ config, connection, availableModels });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const updates: Record<string, string> = {
    "openclaw.enabled": String(!!body.enabled),
    "openclaw.model": String(body.model ?? DEFAULTS.model),
    "openclaw.temperature": String(parseFloat(body.temperature) || DEFAULTS.temperature),
    "openclaw.max_tokens": String(parseInt(body.max_tokens) || DEFAULTS.max_tokens),
    "openclaw.system_prompt": String(body.system_prompt ?? ""),
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
