/**
 * One-time backfill script: reads experienceText from Notion → updates DB
 *
 * Handles 2 cases:
 *   1. Candidate has notionPageId → fetch page directly
 *   2. Candidate has no notionPageId → search Notion DB by lineUserId
 *
 * Run: npx tsx scripts/backfill-experience.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const NOTION_PROP =
  "คุณมีประสบการณ์ด้านงานขายมากี่ปี และเคยขายอะไรบ้าง?";
const SLEEP_MS = 350; // ~3 req/sec

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

/** Fetch a Notion page by its ID */
async function fetchPageById(
  notionToken: string,
  pageId: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": "2022-06-28",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion ${res.status}: ${body.slice(0, 120)}`);
  }
  const page = (await res.json()) as { properties?: Record<string, unknown> };
  return page.properties ?? null;
}

/** Search Notion DB for a page where lineUserId property matches */
async function searchByLineUserId(
  notionToken: string,
  dbId: string,
  lineUserId: string
): Promise<{ pageId: string; properties: Record<string, unknown> } | null> {
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        property: "lineUserId",
        rich_text: { equals: lineUserId },
      },
      page_size: 1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion search ${res.status}: ${body.slice(0, 120)}`);
  }

  const data = (await res.json()) as {
    results: Array<{ id: string; properties: Record<string, unknown> }>;
  };

  if (!data.results.length) return null;

  const page = data.results[0];
  return { pageId: page.id.replace(/-/g, ""), properties: page.properties };
}

async function main() {
  const notionToken = process.env.NOTION_TOKEN;
  const notionDbId = process.env.NOTION_DB_ID;
  if (!notionToken) throw new Error("NOTION_TOKEN not set");
  if (!notionDbId) throw new Error("NOTION_DB_ID not set");

  // All candidates: lineUserId known + experienceText missing
  const candidates = await db.candidate.findMany({
    where: {
      lineUserId: { not: null },
      experienceText: null,
    },
    select: {
      id: true,
      lineUserId: true,
      notionPageId: true,
      nickname: true,
      fullName: true,
    },
  });

  const withPageId = candidates.filter((c) => c.notionPageId);
  const withoutPageId = candidates.filter((c) => !c.notionPageId);

  console.log(`\nCandidates to backfill: ${candidates.length}`);
  console.log(`  มี notionPageId    : ${withPageId.length} (fetch ตรง)`);
  console.log(`  ไม่มี notionPageId : ${withoutPageId.length} (ค้น DB)\n`);

  if (candidates.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // ── Pass 1: candidates that already have notionPageId ────────────────────
  if (withPageId.length > 0) {
    console.log("── Pass 1: fetch by notionPageId ──────────────────────────");
    for (let i = 0; i < withPageId.length; i++) {
      const c = withPageId[i];
      const name = c.fullName ?? c.nickname ?? c.id;
      const progress = `[${i + 1}/${withPageId.length}]`;

      try {
        const props = await fetchPageById(notionToken, c.notionPageId!);
        const text = extractText(props?.[NOTION_PROP]);

        if (text) {
          await db.candidate.update({
            where: { id: c.id },
            data: { experienceText: text },
          });
          console.log(`${progress} ✅ ${name} → "${text.slice(0, 60)}"`);
          updated++;
        } else {
          console.log(`${progress} ⏭  ${name} — ไม่มีข้อมูลประสบการณ์`);
          skipped++;
        }
      } catch (err) {
        console.error(`${progress} ❌ ${name} — ${err instanceof Error ? err.message : err}`);
        errors++;
      }

      await sleep(SLEEP_MS);
    }
  }

  // ── Pass 2: candidates without notionPageId → search by lineUserId ───────
  if (withoutPageId.length > 0) {
    console.log("\n── Pass 2: search Notion DB by lineUserId ─────────────────");
    for (let i = 0; i < withoutPageId.length; i++) {
      const c = withoutPageId[i];
      const name = c.fullName ?? c.nickname ?? c.id;
      const progress = `[${i + 1}/${withoutPageId.length}]`;

      try {
        const result = await searchByLineUserId(notionToken, notionDbId, c.lineUserId!);

        if (!result) {
          console.log(`${progress} ⏭  ${name} — ไม่พบใน Notion`);
          skipped++;
        } else {
          const text = extractText(result.properties[NOTION_PROP]);
          const updateData: Record<string, string> = {
            notionPageId: result.pageId, // บันทึก pageId ด้วยเผื่อใช้ภายหลัง
          };
          if (text) updateData.experienceText = text;

          await db.candidate.update({
            where: { id: c.id },
            data: updateData,
          });

          if (text) {
            console.log(`${progress} ✅ ${name} → "${text.slice(0, 60)}"`);
            updated++;
          } else {
            console.log(`${progress} ⏭  ${name} — พบใน Notion แต่ไม่มีข้อมูลประสบการณ์`);
            skipped++;
          }
        }
      } catch (err) {
        console.error(`${progress} ❌ ${name} — ${err instanceof Error ? err.message : err}`);
        errors++;
      }

      await sleep(SLEEP_MS);
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Done!
  Total   : ${candidates.length}
  Updated : ${updated}
  Skipped : ${skipped}
  Errors  : ${errors}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main()
  .catch(console.error)
  .finally(() => pool.end());
