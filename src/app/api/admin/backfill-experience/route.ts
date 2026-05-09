import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// One-time admin endpoint — backfill experienceText from Notion for existing candidates
//
// Usage:
//   POST /api/admin/backfill-experience
//   Header: x-admin-secret: <ADMIN_SECRET>
//
// Targets: candidates where
//   lineUserId IS NOT NULL
//   AND notionPageId IS NOT NULL
//   AND experienceText IS NULL

const NOTION_PROP =
  "คุณมีประสบการณ์ด้านงานขายมากี่ปี และเคยขายอะไรบ้าง?";
const SLEEP_MS = 350; // ~3 req/sec (Notion rate limit)

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract plain text from a Notion rich_text or title property */
function extractText(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as Record<string, unknown>;

  const arr =
    (p.rich_text as unknown[]) ??
    (p.title as unknown[]) ??
    [];

  if (!Array.isArray(arr)) return "";
  return arr
    .map((chunk) => {
      const c = chunk as Record<string, unknown>;
      return typeof c.plain_text === "string" ? c.plain_text : "";
    })
    .join("")
    .trim();
}

export async function POST(req: Request) {
  // ── auth ──────────────────────────────────────────────────────────────────
  const secret = req.headers.get("x-admin-secret");
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) {
    return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });
  }

  // ── fetch candidates that need backfill ───────────────────────────────────
  const candidates = await db.candidate.findMany({
    where: {
      lineUserId: { not: null },
      notionPageId: { not: null },
      experienceText: null,
    },
    select: { id: true, notionPageId: true },
  });

  const total = candidates.length;
  let updated = 0;
  let skipped = 0; // property empty / not found
  let errors = 0;

  const errorLog: { id: string; notionPageId: string; error: string }[] = [];

  for (const candidate of candidates) {
    const notionPageId = candidate.notionPageId!;

    try {
      const res = await fetch(
        `https://api.notion.com/v1/pages/${notionPageId}`,
        {
          headers: {
            Authorization: `Bearer ${notionToken}`,
            "Notion-Version": "2022-06-28",
          },
        }
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Notion ${res.status}: ${body.slice(0, 120)}`);
      }

      const page = (await res.json()) as {
        properties?: Record<string, unknown>;
      };

      const props = page.properties ?? {};
      const text = extractText(props[NOTION_PROP]);

      if (text) {
        await db.candidate.update({
          where: { id: candidate.id },
          data: { experienceText: text },
        });
        updated++;
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
      errorLog.push({
        id: candidate.id,
        notionPageId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await sleep(SLEEP_MS);
  }

  return NextResponse.json({
    ok: true,
    total,
    updated,
    skipped,
    errors,
    ...(errorLog.length > 0 ? { errorLog } : {}),
  });
}
