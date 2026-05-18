import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const QUEUE_STATUSES = ["WAITING_HR_REVIEW", "BOT_SCREENING", "NEED_MORE_INFO", "NEW_APPLICANT"];

// Extract ที่อยู่ from Notion page properties
async function fetchAddressFromNotion(notionPageId: string): Promise<string | null> {
  if (!NOTION_TOKEN) return null;
  try {
    const cleanId = notionPageId.replace(/-/g, "");
    const res = await fetch(`https://api.notion.com/v1/pages/${cleanId}`, {
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const props = data.properties ?? {};

    // Try common field names for address
    const addressKeys = ["ที่อยู่", "address", "Address", "ที่อยู่ปัจจุบัน"];
    for (const key of addressKeys) {
      const prop = props[key];
      if (!prop) continue;
      if (prop.type === "rich_text" && prop.rich_text?.length > 0) {
        return prop.rich_text.map((t: { plain_text: string }) => t.plain_text).join("").trim() || null;
      }
      if (prop.type === "title" && prop.title?.length > 0) {
        return prop.title.map((t: { plain_text: string }) => t.plain_text).join("").trim() || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    // Get all candidates in queue that have notionPageId but no address yet
    const candidates = await db.candidate.findMany({
      where: {
        currentStatus: { in: QUEUE_STATUSES as any[] },
        notionPageId: { not: null },
        address: null,
      },
      select: { id: true, notionPageId: true },
    });

    if (candidates.length === 0) {
      return NextResponse.json({ updated: 0, message: "ไม่มีข้อมูลที่ต้อง backfill" });
    }

    let updated = 0;
    let failed = 0;

    // Process in batches of 5 to avoid rate limiting
    for (let i = 0; i < candidates.length; i += 5) {
      const batch = candidates.slice(i, i + 5);
      await Promise.all(
        batch.map(async (c) => {
          const address = await fetchAddressFromNotion(c.notionPageId!);
          if (address) {
            await db.candidate.update({
              where: { id: c.id },
              data: { address },
            });
            updated++;
          } else {
            failed++;
          }
        })
      );
      // Small delay between batches
      if (i + 5 < candidates.length) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    return NextResponse.json({ updated, failed, total: candidates.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
