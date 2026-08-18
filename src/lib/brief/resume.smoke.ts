/**
 * Verify resume/portfolio sync against candidates who really attached one.
 */
import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { getNotionDetail } from "../notion-detail";
import { mapNotionFacts, syncFromNotion } from "./notion-sync";

const NOTION_DB = "358b29d9a9fe807a8d39de19fddc9b99";

describe("resume sync", () => {
  it("finds pages with attachments and syncs them", async () => {
    const token = process.env.NOTION_TOKEN!;
    // Query Notion directly for pages that actually have a Resume file.
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_size: 100,
        filter: { property: "Resume", files: { is_not_empty: true } },
      }),
    });
    const json = await res.json();
    const pages: string[] = (json.results ?? []).map((p: { id: string }) => p.id);
    console.log("pages with a Resume:", pages.length);
    expect(pages.length).toBeGreaterThan(0);

    // Parse a few straight from Notion.
    for (const pid of pages.slice(0, 3)) {
      const facts = mapNotionFacts(await getNotionDetail(pid));
      console.log(`  resume=${facts.resumeUrl?.slice(0, 55)} portfolio=${facts.portfolioUrl?.slice(0, 45)}`);
      expect(facts.resumeUrl).toBeTruthy();
    }

    // And through the real sync, for any that exist in our database.
    const ids = pages.map((p) => p.replace(/-/g, ""));
    const ours = await db.candidate.findMany({
      where: { OR: [{ notionPageId: { in: pages } }, { notionPageId: { in: ids } }] },
      select: { id: true },
      take: 3,
    });
    console.log("matching candidates in Postgres:", ours.length);
    for (const c of ours) {
      const r = await syncFromNotion(c.id);
      console.log(`  ${c.id} wrote=[${r.written.join(",")}] resume=${!!r.facts.resumeUrl}`);
    }
  }, 300_000);
});
