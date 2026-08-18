/** Verify equipment syncs out of the Notion form onto real candidates. */
import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { syncFromNotion } from "./notion-sync";

describe("equipment sync", () => {
  it("populates equipment for candidates with a Notion page", async () => {
    const rows = await db.candidate.findMany({
      where: { notionPageId: { not: null }, currentStatus: "WAITING_HR_REVIEW" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true },
    });
    let withEquip = 0;
    for (const r of rows) {
      const res = await syncFromNotion(r.id);
      const eq = res.facts.equipment;
      if (eq.length) withEquip++;
      console.log(`${r.id} equipment=[${eq.join(",")}] wrote=[${res.written.join(",")}]`);
    }
    console.log(`${withEquip}/${rows.length} had equipment on the form`);
    expect(withEquip).toBeGreaterThan(0);
  }, 300_000);
});
