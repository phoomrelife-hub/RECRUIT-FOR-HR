import { describe, it, expect } from "vitest";
import { parseEnabled, platformFromExternalId, settingKey } from "./bot-switch";

describe("parseEnabled", () => {
  it("treats a missing row as enabled — a fresh DB must behave as before", () => {
    expect(parseEnabled(undefined)).toBe(true);
    expect(parseEnabled(null)).toBe(true);
  });

  it("only the literal string \"false\" disables", () => {
    expect(parseEnabled("false")).toBe(false);
    expect(parseEnabled("true")).toBe(true);
    expect(parseEnabled("")).toBe(true);
    expect(parseEnabled("0")).toBe(true);
  });
});

describe("platformFromExternalId", () => {
  it("all-digit ids are Facebook PSIDs", () => {
    expect(platformFromExternalId("24512345678901234")).toBe("FACEBOOK");
    expect(platformFromExternalId("7")).toBe("FACEBOOK");
  });

  it("U-prefixed ids are LINE user ids", () => {
    expect(platformFromExternalId("U1234567890abcdef1234567890abcdef")).toBe("LINE");
  });
});

describe("settingKey", () => {
  it("is stable — changing these strings orphans the saved switch", () => {
    expect(settingKey("LINE")).toBe("bot.enabled.line");
    expect(settingKey("FACEBOOK")).toBe("bot.enabled.facebook");
  });
});
