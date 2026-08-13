import { describe, expect, it } from "vitest";
import { estimateCostUsd, isStale, periodStart } from "./index";

describe("estimateCostUsd", () => {
  it("prices input and output separately", () => {
    const cost = estimateCostUsd({ input: 1_000_000, output: 0 });
    expect(cost).toBeGreaterThan(0);
    expect(estimateCostUsd({ input: 0, output: 1_000_000 })).toBeGreaterThan(cost);
  });

  it("is zero for zero usage", () => {
    expect(estimateCostUsd({ input: 0, output: 0 })).toBe(0);
  });
});

describe("isStale", () => {
  it("is false when the hash matches", () => {
    expect(isStale({ inputHash: "abc" }, "abc")).toBe(false);
  });

  it("is true after the candidate uploads a resume", () => {
    expect(isStale({ inputHash: "abc" }, "def")).toBe(true);
  });
});

describe("periodStart", () => {
  const now = new Date("2026-08-13T10:00:00Z");

  it("starts a monthly period on the 1st", () => {
    expect(periodStart("monthly", now).toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("starts a daily period at midnight today", () => {
    expect(periodStart("daily", now).toISOString()).toBe("2026-08-13T00:00:00.000Z");
  });

  it("starts a weekly period 7 days back", () => {
    expect(periodStart("weekly", now).toISOString()).toBe("2026-08-06T00:00:00.000Z");
  });

  it("falls back to monthly for an unknown period", () => {
    expect(periodStart("fortnightly", now).toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});
