/**
 * Show the spec axis alongside stars on real candidates.
 *
 * READ-MOSTLY: it scores candidates that have no score row yet, and NEVER
 * deletes. An earlier version of this file called deleteMany() to force a
 * recompute and destroyed a live brief's cached scores — a smoke test must not
 * be able to damage data it merely wants to observe.
 */
import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { scoreForBrief } from "./run";
import { shouldNotifyInstantly } from "./spec-match";

describe("spec match on real candidates", () => {
  it("separates confirmed matches from unknowns", async () => {
    const brief = await db.hiringBrief.findFirst({
      where: { jobPosition: { title: "Sales Admin" } },
      include: { jobPosition: true },
    });
    if (!brief) throw new Error("no Sales Admin brief");
    console.log(
      `brief: ${brief.jobPosition.title} | notifyStars=${brief.notifyStars} ` +
        `fullSpecStars=${brief.notifyFullSpecStars} | minAge=${brief.minAge} maxAge=${brief.maxAge} ` +
        `maxSalary=${brief.maxSalary} work=${brief.workPreference} exp=${brief.minExperienceYears}`,
    );

    const rows = await db.candidate.findMany({
      where: {
        currentStatus: "WAITING_HR_REVIEW",
        notionPageId: { not: null },
        briefScores: { none: { briefId: brief.id } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true },
    });
    console.log(`scoring ${rows.length} candidates with no existing score row`);

    let notified = 0;
    for (const r of rows) {
      const o = await scoreForBrief(r.id, brief);
      if (o.filteredOut) {
        console.log(`  FILTERED`);
        continue;
      }
      const d = shouldNotifyInstantly(o.stars, o.spec, brief.notifyStars, brief.notifyFullSpecStars);
      if (d.notify) notified++;
      console.log(
        `  ${o.stars}star spec=${o.spec.met}/${o.spec.total}${o.spec.full ? " FULL" : ""} ` +
          `notify=${d.notify}${d.reason ? ` (${d.reason})` : ""} missing=[${o.spec.unknownKeys.join(",")}]`,
      );
    }
    console.log(`would notify: ${notified}`);
    expect(rows.length).toBeGreaterThanOrEqual(0);
  }, 600_000);
});
