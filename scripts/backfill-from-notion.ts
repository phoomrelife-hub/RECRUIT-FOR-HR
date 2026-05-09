/**
 * Backfill experienceText by pulling ALL pages from Notion DB first,
 * then matching lineUserId → candidate in our DB.
 *
 * Run: npx tsx scripts/backfill-from-notion.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const NOTION_PROP     = "คุณมีประสบการณ์ด้านงานขายมากี่ปี และเคยขายอะไรบ้าง?";
const NOTION_NAME     = "ชื่อ - นามสกุล / ชื่อเล่น";
const NOTION_POSITION = "ตำแหน่งที่สมัคร";
const SLEEP_MS = 350;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter } as never);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractText(prop: unknown): string {
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

type NotionPage = {
  id: string;
  properties: Record<string, unknown>;
};

/** Pull all pages from Notion DB (handles pagination) */
async function fetchAllNotionPages(
  notionToken: string,
  dbId: string
): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  let page = 1;

  while (true) {
    console.log(`  Fetching Notion page ${page}...`);
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion DB query failed ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      results: NotionPage[];
      has_more: boolean;
      next_cursor: string | null;
    };

    pages.push(...data.results);

    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
    page++;

    await sleep(SLEEP_MS);
  }

  return pages;
}

async function main() {
  const notionToken = process.env.NOTION_TOKEN;
  const notionDbId = process.env.NOTION_DB_ID;
  if (!notionToken) throw new Error("NOTION_TOKEN not set");
  if (!notionDbId) throw new Error("NOTION_DB_ID not set");

  // ── Step 1: pull all Notion pages ────────────────────────────────────────
  console.log("\nPulling all pages from Notion DB...");
  const pages = await fetchAllNotionPages(notionToken, notionDbId);
  console.log(`Got ${pages.length} pages from Notion\n`);

  // ── Step 2: build map lineUserId → { notionPageId, experienceText, fullName } ──
  type NotionEntry = { notionPageId: string; experienceText: string; fullName: string; position: string };
  const notionMap = new Map<string, NotionEntry>();

  for (const page of pages) {
    const lineUserId = extractText(page.properties["lineUserId"]);
    if (!lineUserId) continue;

    const experienceText = extractText(page.properties[NOTION_PROP]);
    const fullName       = extractText(page.properties[NOTION_NAME]);
    const notionPageId   = page.id.replace(/-/g, "");

    // position เป็น select property
    const posProp = page.properties[NOTION_POSITION] as Record<string, unknown> | undefined;
    const position = (posProp?.select as Record<string, unknown> | undefined)?.name as string ?? "";

    // ถ้า lineUserId ซ้ำ ให้เก็บอันที่มีข้อมูลประสบการณ์
    const existing = notionMap.get(lineUserId);
    if (!existing || (!existing.experienceText && experienceText)) {
      notionMap.set(lineUserId, { notionPageId, experienceText, fullName, position });
    }
  }

  console.log(`Pages with lineUserId: ${notionMap.size}`);

  // ── Step 3: load job positions map (title → id) ───────────────────────────
  const jobPositions = await db.jobPosition.findMany({ select: { id: true, title: true } });
  const jobMap = new Map(jobPositions.map((j) => [j.title.toLowerCase(), j.id]));

  // ── Step 4: load candidates from DB that still need backfill ──────────────
  // ดึงคนที่ยังขาด experienceText, fullName หรือ interestedPositionId
  const candidates = await db.candidate.findMany({
    where: {
      lineUserId: { not: null },
      OR: [
        { experienceText: null },
        { fullName: null },
        { interestedPositionId: null },
      ],
    },
    select: {
      id: true, lineUserId: true, nickname: true, fullName: true,
      notionPageId: true, experienceText: true, interestedPositionId: true,
    },
  });

  console.log(`Candidates needing backfill: ${candidates.length}\n`);

  // ── Step 5: match and update ──────────────────────────────────────────────
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const name = c.fullName ?? c.nickname ?? c.id;
    const progress = `[${i + 1}/${candidates.length}]`;

    const entry = notionMap.get(c.lineUserId!);

    if (!entry) {
      notFound++;
      continue; // ไม่มีใน Notion เลย
    }

    const updateData: Record<string, string> = {};
    if (!c.notionPageId) updateData.notionPageId = entry.notionPageId;
    if (!c.experienceText && entry.experienceText) updateData.experienceText = entry.experienceText;
    if (!c.fullName && entry.fullName) updateData.fullName = entry.fullName;
    if (!c.interestedPositionId && entry.position) {
      const jobId = jobMap.get(entry.position.toLowerCase());
      if (jobId) updateData.interestedPositionId = jobId;
    }

    if (Object.keys(updateData).length === 0) {
      skipped++;
      continue;
    }

    try {
      await db.candidate.update({ where: { id: c.id }, data: updateData });

      const parts: string[] = [];
      if (updateData.fullName) parts.push(`ชื่อ: "${updateData.fullName}"`);
      if (updateData.experienceText) parts.push(`ประสบการณ์: "${updateData.experienceText.slice(0, 40)}"`);
      if (updateData.interestedPositionId) parts.push(`ตำแหน่ง: "${entry.position}"`);

      console.log(`${progress} ✅ ${name} → ${parts.join(" | ")}`);
      updated++;
    } catch (err) {
      console.error(`${progress} ❌ ${name} — ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Done!
  Notion pages total  : ${pages.length}
  Notion w/ lineUserId: ${notionMap.size}
  DB candidates       : ${candidates.length}
  Updated             : ${updated}
  Skipped (no exp.)   : ${skipped}
  Not in Notion       : ${notFound}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main()
  .catch(console.error)
  .finally(() => pool.end());
