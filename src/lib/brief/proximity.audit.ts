/**
 * Audit the proximity classifier against every real address on file.
 *
 *   npx vitest run --config vitest.smoke.config.ts src/lib/brief/proximity.audit.ts
 *
 * Read-only. Exists to answer "how many candidates are actually near the
 * office", and to surface addresses the classifier cannot read — a silent
 * "unknown" on a perfectly good address is the failure mode to watch for.
 */
import { describe, it } from "vitest";
import pg from "pg";
import { classifyProximity, type ProximityTier } from "./proximity";

describe("proximity audit", () => {
  it("classifies every stored address", async () => {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    const rows = (
      await c.query(
        `select address from candidates where address is not null and address <> ''`,
      )
    ).rows as Array<{ address: string }>;
    await c.end();

    const counts: Record<string, number> = {};
    const unreadable: string[] = [];
    for (const r of rows) {
      const t: ProximityTier = classifyProximity(r.address).tier;
      counts[t] = (counts[t] ?? 0) + 1;
      if (t === "unknown") unreadable.push(r.address);
    }

    console.log(`total addresses: ${rows.length}`);
    console.log("distribution:", counts);
    console.log(
      `unreadable (${unreadable.length}):`,
      unreadable.slice(0, 25).map((a) => a.slice(0, 60)),
    );
  }, 60_000);
});
