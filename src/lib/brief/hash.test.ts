import { describe, it, expect } from "vitest";
import { briefHash } from "./hash";
import { EMPTY_HARD_FILTERS } from "./types";

const base = {
  filters: { ...EMPTY_HARD_FILTERS, maxAge: 40 },
  criteria: [{ name: "ประสบการณ์ขาย", weight: 3, description: "ดูจากใบสมัคร" }],
};

describe("briefHash", () => {
  it("is stable for identical content", () => {
    expect(briefHash(base)).toBe(briefHash({ ...base }));
  });

  it("changes when a filter changes", () => {
    expect(briefHash({ ...base, filters: { ...base.filters, maxAge: 45 } })).not.toBe(
      briefHash(base),
    );
  });

  it("changes when criteria change", () => {
    expect(
      briefHash({ ...base, criteria: [{ name: "อื่น", weight: 3, description: "" }] }),
    ).not.toBe(briefHash(base));
  });

  // Without this, tightening the distance rule would leave every cached score
  // looking fresh and the new rule would silently never apply.
  it("changes when the proximity threshold changes", () => {
    expect(briefHash(base, "adjacent")).not.toBe(briefHash(base, "nearby"));
    expect(briefHash(base, null)).toBe(briefHash(base));
  });
});
