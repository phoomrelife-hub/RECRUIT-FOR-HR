import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public endpoint — no auth required, called by OpenClaw bot on WSL

const SECTION_LABELS: Record<string, string> = {
  objectives: "เป้าหมายหลัก",
  identity: "ตัวตนและน้ำเสียง",
  critical_rules: "กฎสำคัญ",
  conversation_flow: "ลำดับการสนทนา",
  positions: "ข้อมูลตำแหน่งงานและบริษัท",
  contact: "ข้อมูลติดต่อ",
  faqs: "คำถามที่พบบ่อย",
  response_templates: "Template การตอบ",
};

const SECTION_ORDER = [
  "objectives",
  "identity",
  "critical_rules",
  "conversation_flow",
  "positions",
  "contact",
  "faqs",
  "response_templates",
];

export async function GET() {
  const rows = await db.setting.findMany({
    where: { key: { startsWith: "openclaw.rules." } },
  });

  const saved: Record<string, string> = {};
  for (const r of rows) saved[r.key.replace("openclaw.rules.", "")] = r.value;

  const active = saved["active"] === "true";
  const botName = saved["bot_name"] ?? "";
  const tone = saved["tone"] ?? "";
  const language = saved["language"] ?? "";

  const sections: Record<string, string> = {};
  for (const key of SECTION_ORDER) {
    sections[key] = saved[key] ?? "";
  }

  // Build header with bot metadata
  const parts: string[] = [];

  if (botName || tone || language) {
    const meta: string[] = [];
    if (botName) meta.push(`ชื่อบอท: ${botName}`);
    if (tone) meta.push(`โทนเสียง: ${tone}`);
    if (language) meta.push(`ภาษา: ${language}`);
    parts.push(`## ข้อมูลบอท\n${meta.join("\n")}`);
  }

  for (const key of SECTION_ORDER) {
    const content = sections[key]?.trim();
    if (content) {
      parts.push(`## ${SECTION_LABELS[key]}\n${content}`);
    }
  }

  const prompt = parts.join("\n\n");

  return NextResponse.json(
    { active, prompt, sections, bot_name: botName, tone, language },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
