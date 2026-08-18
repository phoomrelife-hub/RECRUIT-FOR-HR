/**
 * Inspect real Notion pages so the sync is built against what the form actually
 * returns, not against what the property names suggest.
 *   npx vitest run --config vitest.smoke.config.ts src/lib/brief/notion.audit.ts
 */
import { describe, it } from "vitest";
import pg from "pg";
import { getNotionDetail } from "../notion-detail";

describe("notion audit", () => {
  it("dumps parsed detail for a few real candidates", async () => {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    const rows = (
      await c.query(
        `select id, notion_page_id from candidates
         where notion_page_id is not null and current_status='WAITING_HR_REVIEW' limit 3`,
      )
    ).rows as Array<{ id: string; notion_page_id: string }>;
    await c.end();

    for (const r of rows) {
      try {
        const d = await getNotionDetail(r.notion_page_id);
        console.log(`\n=== ${r.id}`);
        console.log("info:", JSON.stringify(d.info, null, 1));
        console.log("file props:", d.allProps.filter((p) => p.type === "files").map((p) => `${p.name}=${JSON.stringify(p.value)}`));
        console.log("prop names:", d.allProps.map((p) => `${p.name}[${p.type}]`).join(" | "));
        console.log("qa count:", d.qa.length, d.qa.slice(0, 2));
      } catch (e) {
        console.log(`=== ${r.id} FAILED:`, e instanceof Error ? e.message : e);
      }
    }
  }, 90_000);
});
