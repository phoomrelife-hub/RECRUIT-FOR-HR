/**
 * End-to-end pipeline test against REAL candidates. Writes to the database and
 * spends money — deliberately limited to a handful of rows.
 */
import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { ensureExtraction } from "./run";
import { classifyProximity } from "./proximity";

describe("live pipeline", () => {
  it("pulls Notion facts for real WAITING_HR_REVIEW candidates", async () => {
    const rows = await db.candidate.findMany({
      where: { currentStatus: "WAITING_HR_REVIEW", notionPageId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true },
    });
    expect(rows.length).toBeGreaterThan(0);

    for (const r of rows) {
      const e = await ensureExtraction(r.id);
      const prox = classifyProximity(e.address);
      console.log(
        `${r.id}  age=${e.facts.age} salary=${e.facts.expectedSalary} ` +
          `sales=${e.facts.maxSalesAmount} years=${e.facts.experienceYears} ` +
          `work=${e.facts.workPreference} | prox=${prox.tier}(${prox.matched ?? "-"}) ` +
          `| notionChars=${e.notionEvidence.length} calledModel=${e.called} $${e.costUsd.toFixed(5)}`,
      );
    }
  }, 300_000);
});
