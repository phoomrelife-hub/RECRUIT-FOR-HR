import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// ── Notion helpers ────────────────────────────────────────────────────────────

function richText(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as Record<string, unknown>;
  const arr = (p.rich_text as unknown[]) ?? (p.title as unknown[]) ?? [];
  if (!Array.isArray(arr)) return "";
  return arr
    .map((c) => {
      const chunk = c as Record<string, unknown>;
      return typeof chunk.plain_text === "string" ? chunk.plain_text : "";
    })
    .join("")
    .trim();
}

function selectVal(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as Record<string, unknown>;
  const s = p.select as Record<string, unknown> | undefined;
  return typeof s?.name === "string" ? s.name : "";
}

function multiSelectVal(prop: unknown): string[] {
  if (!prop || typeof prop !== "object") return [];
  const p = prop as Record<string, unknown>;
  const arr = p.multi_select as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => (typeof s.name === "string" ? s.name : "")).filter(Boolean);
}

function numVal(prop: unknown): number | null {
  if (!prop || typeof prop !== "object") return null;
  const p = prop as Record<string, unknown>;
  return typeof p.number === "number" ? p.number : null;
}

function emailVal(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as Record<string, unknown>;
  return typeof p.email === "string" ? p.email : "";
}

function phoneVal(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as Record<string, unknown>;
  return typeof p.phone_number === "string" ? p.phone_number : "";
}

async function notionFetch(url: string, token: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
    },
  });
  if (!res.ok) throw new Error(`Notion ${res.status}`);
  return res.json();
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await auth();

  const { id } = await params;
  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) {
    return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });
  }

  const candidate = await db.candidate.findUnique({
    where: { id },
    select: { notionPageId: true },
  });

  if (!candidate?.notionPageId) {
    return NextResponse.json({ error: "no_notion_page" }, { status: 404 });
  }

  const pageId = candidate.notionPageId;

  // Fetch page properties + blocks in parallel
  let page: Record<string, unknown>;
  let blocksData: Record<string, unknown>;
  try {
    const results = await Promise.all([
      notionFetch(`https://api.notion.com/v1/pages/${pageId}`, notionToken),
      notionFetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, notionToken),
    ]);
    page = results[0] as Record<string, unknown>;
    blocksData = results[1] as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[notion-detail] fetch error:", msg, "pageId:", pageId);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const props = (page as { properties: Record<string, unknown> }).properties ?? {};

  // ── Extract properties ────────────────────────────────────────────────────
  const info = {
    name:            richText(props["ชื่อ - นามสกุล / ชื่อเล่น"]),
    phone:           phoneVal(props["เบอร์โทรติดต่อ"]),
    email:           emailVal(props["อีเมลติดต่อ (Email)"]),
    age:             numVal(props["อายุ"]),
    children:        numVal(props["คุณมีบุตรกี่คน"]),
    address:         richText(props["ที่อยู่ปัจจุบัน"]),
    position:        selectVal(props["ตำแหน่งที่สมัคร"]),
    experience:      richText(props["คุณมีประสบการณ์ด้านงานขายมากี่ปี และเคยขายอะไรบ้าง?"]),
    maxSales:        richText(props["ยอดขายที่เคยทำได้สูงสุด (ต่อเดือน)"]),
    expectedSalary:  richText(props["รายได้ที่คาดหวัง (ต่อเดือน)"]),
    equipment:       multiSelectVal(props["อุปกรณ์ที่มีพร้อม (เลือกทั้งหมดที่มี)"]),
    lineId:          richText(props["ID Line ติดต่อกลับ"]),
  };

  // ── Extract deep Q&A from blocks ─────────────────────────────────────────
  // Format: h1 "📝 คำถามเชิงลึก", then pairs of h2 (question) + paragraph (answer)
  type QA = { question: string; answer: string };
  const qa: QA[] = [];

  const blocks = (blocksData as { results: Array<Record<string, unknown>> }).results ?? [];
  let inDeepSection = false;
  let currentQuestion = "";

  for (const block of blocks) {
    const type = block.type as string;

    if (type === "heading_1") {
      const text = richText(block.heading_1);
      if (text.includes("คำถามเชิงลึก")) {
        inDeepSection = true;
        continue;
      }
    }

    if (!inDeepSection) continue;

    if (type === "heading_2") {
      currentQuestion = richText(block.heading_2);
    } else if (type === "paragraph" && currentQuestion) {
      const answer = richText(block.paragraph);
      qa.push({ question: currentQuestion, answer: answer || "(ไม่ได้ตอบ)" });
      currentQuestion = "";
    }
  }

  return NextResponse.json({ info, qa });
}
