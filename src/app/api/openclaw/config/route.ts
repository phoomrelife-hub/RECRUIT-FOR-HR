import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public endpoint — no auth required, called by OpenClaw bot on WSL

export async function GET() {
  const rows = await db.setting.findMany({
    where: { key: { startsWith: "openclaw.rules." } },
  });

  const saved: Record<string, string> = {};
  for (const r of rows) saved[r.key.replace("openclaw.rules.", "")] = r.value;

  const active = saved["active"] === "true";

  const sections = {
    identity: saved["identity"] ?? "",
    critical_rules: saved["critical_rules"] ?? "",
    positions: saved["positions"] ?? "",
    contact: saved["contact"] ?? "",
  };

  // Compile all non-empty sections into a single readable system prompt
  const parts: string[] = [];

  if (sections.identity.trim()) {
    parts.push(`## ตัวตนและน้ำเสียง\n${sections.identity.trim()}`);
  }
  if (sections.critical_rules.trim()) {
    parts.push(`## กฎสำคัญ\n${sections.critical_rules.trim()}`);
  }
  if (sections.positions.trim()) {
    parts.push(`## ข้อมูลตำแหน่งงานและบริษัท\n${sections.positions.trim()}`);
  }
  if (sections.contact.trim()) {
    parts.push(`## ข้อมูลติดต่อ\n${sections.contact.trim()}`);
  }

  const prompt = parts.join("\n\n");

  return NextResponse.json(
    { active, prompt, sections },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
