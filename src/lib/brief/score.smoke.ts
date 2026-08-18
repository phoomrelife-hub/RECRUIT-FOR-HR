/**
 * Score real candidates against the real brief. Spends money.
 */
import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { scoreForBrief, briefCriteria, briefFilters } from "./run";
import { parseBrief } from "./parse";
import { briefHash } from "./hash";
import type { Prisma } from "@prisma/client";

describe("live scoring", () => {
  it("produces a ranking rather than a flat list", async () => {
    let brief = await db.hiringBrief.findFirst({ include: { jobPosition: true } });
    if (!brief) throw new Error("no brief — create one in the UI first");

    // Briefs saved before the >=3 criteria floor existed still hold one
    // criterion. Re-parse through the real path so this exercises production
    // behaviour rather than a hand-patched row.
    if (briefCriteria(brief).length < 3) {
      const { parsed } = await parseBrief(brief.rawBrief, brief.jobPosition.title);
      await db.hiringBrief.update({
        where: { id: brief.id },
        data: {
          ...parsed.filters,
          criteria: parsed.criteria as unknown as Prisma.InputJsonValue,
          briefHash: briefHash(parsed, brief.minProximity),
        },
      });
      brief = await db.hiringBrief.findFirstOrThrow({
        where: { id: brief.id },
        include: { jobPosition: true },
      });
      void briefFilters(brief);
    }
    console.log(
      `brief: ${brief.jobPosition.title} | criteria: ${briefCriteria(brief)
        .map((c) => `${c.name}(${c.weight})`)
        .join(", ")}`,
    );

    const rows = await db.candidate.findMany({
      where: { currentStatus: "WAITING_HR_REVIEW", notionPageId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true },
    });

    const out: number[] = [];
    for (const r of rows) {
      const o = await scoreForBrief(r.id, brief);
      out.push(o.stars);
      console.log(
        `${o.stars}star prox=${o.proximityTier} filtered=${o.filteredOut} cached=${o.cached} $${o.costUsd.toFixed(5)}`,
      );
    }

    const scored = out.filter((s) => s > 0);
    console.log("distribution:", out);
    // The bug this replaces: every candidate landed on the same star count.
    expect(new Set(scored).size).toBeGreaterThan(1);
  }, 600_000);
});
