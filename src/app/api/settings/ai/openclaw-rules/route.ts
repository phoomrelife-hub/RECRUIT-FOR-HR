import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const KEYS = [
  "openclaw.rules.identity",
  "openclaw.rules.critical_rules",
  "openclaw.rules.positions",
  "openclaw.rules.contact",
  "openclaw.rules.active",
] as const;

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.setting.findMany({
    where: { key: { in: [...KEYS] } },
  });

  const saved: Record<string, string> = {};
  for (const r of rows) saved[r.key] = r.value;

  return NextResponse.json({
    identity: saved["openclaw.rules.identity"] ?? "",
    critical_rules: saved["openclaw.rules.critical_rules"] ?? "",
    positions: saved["openclaw.rules.positions"] ?? "",
    contact: saved["openclaw.rules.contact"] ?? "",
    active: saved["openclaw.rules.active"] ?? "false",
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const updates: Record<string, string> = {
    "openclaw.rules.identity": String(body.identity ?? ""),
    "openclaw.rules.critical_rules": String(body.critical_rules ?? ""),
    "openclaw.rules.positions": String(body.positions ?? ""),
    "openclaw.rules.contact": String(body.contact ?? ""),
    "openclaw.rules.active": body.active === true || body.active === "true" ? "true" : "false",
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
