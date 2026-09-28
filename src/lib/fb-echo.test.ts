import { beforeEach, describe, expect, it, vi } from "vitest";

// db and the Graph lookup are stubbed; what's under test is the sorting of
// echoes (ours vs a person in Business Suite) and what gets written for each.
const messageFindFirst = vi.fn();
const messageCreate = vi.fn();
const messageUpdate = vi.fn();
const candidateFindUnique = vi.fn();
const conversationFindFirst = vi.fn();
const conversationUpdate = vi.fn();
const getOwnFbAppId = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    message: {
      findFirst: (a: unknown) => messageFindFirst(a),
      create: (a: unknown) => messageCreate(a),
      update: (a: unknown) => messageUpdate(a),
    },
    candidate: { findUnique: (a: unknown) => candidateFindUnique(a) },
    conversation: {
      findFirst: (a: unknown) => conversationFindFirst(a),
      update: (a: unknown) => conversationUpdate(a),
    },
  },
}));
vi.mock("@/lib/facebook", () => ({ getOwnFbAppId: () => getOwnFbAppId() }));

const { classifyEcho, echoContent, handleFbEcho } = await import("./fb-echo");

const BOT_APP = "946881217956593"; // AOM ChatBot on the VPS
const OUR_APP = "111";
const BUSINESS_SUITE = "263902037430900";
const PSID = "24000000000000001";

describe("classifyEcho", () => {
  const own = new Set([BOT_APP, OUR_APP]);

  it("recognises the bot and this app as ours, as number or string", () => {
    expect(classifyEcho(BOT_APP, own, true)).toBe("OURS");
    expect(classifyEcho(Number(OUR_APP), own, true)).toBe("OURS");
  });

  it("treats any other app, or none, as a person in Meta's inbox", () => {
    expect(classifyEcho(BUSINESS_SUITE, own, true)).toBe("PAGE_INBOX");
    expect(classifyEcho(undefined, own, true)).toBe("PAGE_INBOX");
  });

  it("refuses to guess when this app's own id is unknown", () => {
    expect(classifyEcho(BUSINESS_SUITE, new Set([BOT_APP]), false)).toBe("UNKNOWN");
    // the bot is still recognised even then
    expect(classifyEcho(BOT_APP, new Set([BOT_APP]), false)).toBe("OURS");
  });
});

describe("echoContent", () => {
  it("uses trimmed text, else an attachment placeholder", () => {
    expect(echoContent({ mid: "m", text: "  สวัสดีค่ะ " })).toBe("สวัสดีค่ะ");
    expect(echoContent({ mid: "m", attachments: [{ type: "image" }] })).toBe("[📷 รูปภาพ]");
    expect(echoContent({ mid: "m" })).toBeNull();
  });
});

describe("handleFbEcho", () => {
  const conv = { id: "conv1", botEnabled: true };

  beforeEach(() => {
    vi.clearAllMocks();
    getOwnFbAppId.mockResolvedValue(OUR_APP);
    messageFindFirst.mockResolvedValue(null);
    candidateFindUnique.mockResolvedValue({ id: "cand1" });
    conversationFindFirst.mockResolvedValue(conv);
  });

  it("ignores the bot's own replies entirely", async () => {
    await handleFbEcho(PSID, { mid: "m1", text: "hi", is_echo: true, app_id: BOT_APP }, 1);
    expect(messageCreate).not.toHaveBeenCalled();
    expect(conversationUpdate).not.toHaveBeenCalled();
  });

  it("drops everything but ours when this app's id cannot be resolved", async () => {
    getOwnFbAppId.mockResolvedValue(null);
    await handleFbEcho(PSID, { mid: "m1", text: "hi", is_echo: true, app_id: BUSINESS_SUITE }, 1);
    expect(messageCreate).not.toHaveBeenCalled();
    expect(conversationUpdate).not.toHaveBeenCalled();
  });

  it("records a Business Suite reply as HR and pauses the bot", async () => {
    await handleFbEcho(
      PSID,
      { mid: "m2", text: "นัดสัมภาษณ์พรุ่งนี้นะคะ", is_echo: true, app_id: BUSINESS_SUITE },
      1_790_000_000_000,
    );
    expect(candidateFindUnique).toHaveBeenCalledWith({ where: { facebookUserId: PSID } });
    expect(messageCreate).toHaveBeenCalledWith({
      data: {
        conversationId: "conv1",
        content: "นัดสัมภาษณ์พรุ่งนี้นะคะ",
        senderType: "HR",
        externalId: "m2",
        createdAt: new Date(1_790_000_000_000),
      },
    });
    // + the visible "bot paused" marker
    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ senderType: "SYSTEM" }) }),
    );
    expect(conversationUpdate).toHaveBeenCalledWith({
      where: { id: "conv1" },
      data: expect.objectContaining({ botEnabled: false }),
    });
  });

  it("does not repeat the paused marker when the bot is already off", async () => {
    conversationFindFirst.mockResolvedValue({ id: "conv1", botEnabled: false });
    await handleFbEcho(PSID, { mid: "m3", text: "ok", is_echo: true, app_id: BUSINESS_SUITE }, 1);
    expect(messageCreate).toHaveBeenCalledTimes(1);
  });

  it("skips an echo it has already stored (Meta retries webhooks)", async () => {
    messageFindFirst.mockResolvedValueOnce({ id: "already" });
    await handleFbEcho(PSID, { mid: "m2", text: "ok", is_echo: true, app_id: BUSINESS_SUITE }, 1);
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("claims a matching message we saved ourselves instead of duplicating it", async () => {
    messageFindFirst
      .mockResolvedValueOnce(null) // no message with this mid yet
      .mockResolvedValueOnce({ id: "saved-by-inbox" }); // same text, just sent
    await handleFbEcho(PSID, { mid: "m4", text: "ok", is_echo: true, app_id: BUSINESS_SUITE }, 1);
    expect(messageUpdate).toHaveBeenCalledWith({
      where: { id: "saved-by-inbox" },
      data: { externalId: "m4" },
    });
    expect(messageCreate).not.toHaveBeenCalled();
    expect(conversationUpdate).not.toHaveBeenCalled();
  });

  it("does nothing for someone who never messaged us", async () => {
    candidateFindUnique.mockResolvedValue(null);
    await handleFbEcho(PSID, { mid: "m5", text: "ok", is_echo: true, app_id: BUSINESS_SUITE }, 1);
    expect(messageCreate).not.toHaveBeenCalled();
  });
});
