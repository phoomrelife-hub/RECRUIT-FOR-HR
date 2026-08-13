import { describe, expect, it } from "vitest";
import { compareByAssessment, compareForSalesAdminTab, type QueueSortable } from "./review-queue-sort";
import type { Tier } from "./experience-tier";

const cand = (opts: {
  verdict?: "STRONG" | "PROMISING" | "WEAK" | "INSUFFICIENT_DATA";
  score?: number;
  tier?: Tier;
  createdAt?: string;
}): QueueSortable => ({
  assessment:
    opts.verdict === undefined
      ? null
      : { verdict: opts.verdict, overallScore: opts.score ?? 0 },
  experienceText: tierText(opts.tier),
  createdAt: opts.createdAt ?? "2026-01-01T00:00:00Z",
});

// Minimal text each real Tier value parses back to via parseTier() —
// avoids inventing strings the comparator doesn't actually read through
// parseTier's own rules.
function tierText(tier: Tier | undefined): string | null {
  switch (tier) {
    case "high": return "5 ปี ขายเครื่องใช้ไฟฟ้า";
    case "mid": return "2 ปี ขายประกัน";
    case "low": return "6 เดือน ขายของออนไลน์";
    case "unspecified": return "เคยขายของ";
    case "none": return "ไม่มีประสบการณ์เลย";
    default: return null;
  }
}

describe("compareByAssessment", () => {
  it("sorts an unassessed candidate after an assessed one, in both argument orders", () => {
    const assessed = cand({ verdict: "WEAK", score: 10 });
    const unassessed = cand({});
    expect(compareByAssessment(assessed, unassessed)).toBeLessThan(0);
    expect(compareByAssessment(unassessed, assessed)).toBeGreaterThan(0);
  });

  it("treats two unassessed candidates as equal", () => {
    expect(compareByAssessment(cand({}), cand({}))).toBe(0);
  });

  it("orders verdicts STRONG < PROMISING < WEAK < INSUFFICIENT_DATA", () => {
    const strong = cand({ verdict: "STRONG", score: 50 });
    const promising = cand({ verdict: "PROMISING", score: 50 });
    const weak = cand({ verdict: "WEAK", score: 50 });
    const insufficient = cand({ verdict: "INSUFFICIENT_DATA", score: 50 });

    expect(compareByAssessment(strong, promising)).toBeLessThan(0);
    expect(compareByAssessment(promising, weak)).toBeLessThan(0);
    expect(compareByAssessment(weak, insufficient)).toBeLessThan(0);
  });

  it("sorts the higher overallScore first within one verdict", () => {
    const high = cand({ verdict: "PROMISING", score: 90 });
    const low = cand({ verdict: "PROMISING", score: 40 });
    expect(compareByAssessment(high, low)).toBeLessThan(0);
    expect(compareByAssessment(low, high)).toBeGreaterThan(0);
  });

  it("regression guard: unassessed must not be treated as score 0", () => {
    // A candidate scored 0 on a real (WEAK) assessment must still outrank
    // one with no assessment at all — collapsing null into 0 would tie them.
    const scoredZero = cand({ verdict: "WEAK", score: 0 });
    const unassessed = cand({});
    expect(compareByAssessment(scoredZero, unassessed)).toBeLessThan(0);
    expect(compareByAssessment(unassessed, scoredZero)).toBeGreaterThan(0);
  });
});

describe("compareForSalesAdminTab", () => {
  it("lets verdict rank win over tier — higher verdict, worse tier still sorts first", () => {
    const betterVerdictWorseTier = cand({ verdict: "STRONG", score: 50, tier: "none" });
    const worseVerdictBetterTier = cand({ verdict: "WEAK", score: 50, tier: "high" });
    expect(compareForSalesAdminTab(betterVerdictWorseTier, worseVerdictBetterTier)).toBeLessThan(0);
  });

  it("uses tier as a tiebreak only when verdict and score are equal", () => {
    const highTier = cand({ verdict: "PROMISING", score: 70, tier: "high" });
    const lowTier = cand({ verdict: "PROMISING", score: 70, tier: "low" });
    expect(compareForSalesAdminTab(highTier, lowTier)).toBeLessThan(0);
    expect(compareForSalesAdminTab(lowTier, highTier)).toBeGreaterThan(0);

    // Different score in the same verdict — score still decides, tier is not consulted.
    const higherScoreWorseTier = cand({ verdict: "PROMISING", score: 90, tier: "none" });
    const lowerScoreBetterTier = cand({ verdict: "PROMISING", score: 60, tier: "high" });
    expect(compareForSalesAdminTab(higherScoreWorseTier, lowerScoreBetterTier)).toBeLessThan(0);
  });

  it("uses createdAt as the final tiebreak only when verdict, score, and tier all match", () => {
    const earlier = cand({ verdict: "STRONG", score: 80, tier: "mid", createdAt: "2026-01-01T00:00:00Z" });
    const later = cand({ verdict: "STRONG", score: 80, tier: "mid", createdAt: "2026-02-01T00:00:00Z" });
    expect(compareForSalesAdminTab(earlier, later)).toBeLessThan(0);
    expect(compareForSalesAdminTab(later, earlier)).toBeGreaterThan(0);
  });

  it("still sorts unassessed candidates last", () => {
    const assessed = cand({ verdict: "INSUFFICIENT_DATA", score: 5, tier: "none" });
    const unassessed = cand({ tier: "high" }); // even a great tier can't outrank an assessed candidate
    expect(compareForSalesAdminTab(assessed, unassessed)).toBeLessThan(0);
    expect(compareForSalesAdminTab(unassessed, assessed)).toBeGreaterThan(0);
  });
});
