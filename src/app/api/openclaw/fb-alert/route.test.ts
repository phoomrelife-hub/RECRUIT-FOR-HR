import { beforeEach, describe, expect, it, vi } from "vitest";

// The route talks to Setting rows and Telegram. Both are stubbed so this test
// exercises the part that can actually break: mapping the VPS payload onto
// stored state, and paging humans exactly once per outage (not once per retry).
const findMany = vi.fn();
const upsert = vi.fn((args: unknown) => args);
const $transaction = vi.fn();
const sendOpsAlert = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    setting: {
      findMany: (args: unknown) => findMany(args),
      upsert: (args: unknown) => upsert(args),
    },
    $transaction: (ops: unknown) => $transaction(ops),
  },
}));
vi.mock("@/lib/telegram", () => ({ sendOpsAlert: (t: string) => sendOpsAlert(t) }));

const { POST } = await import("./route");

const request = (body: unknown) =>
  new Request("http://localhost/api/openclaw/fb-alert", {
    method: "POST",
    body: JSON.stringify(body),
  });

/** Settings rows as they would look mid-outage. */
const blockedRows = [
  { key: "fb.health.status", value: "blocked" },
  { key: "fb.health.code", value: "2022" },
  { key: "fb.health.since", value: "2026-06-23T15:45:10.000Z" },
  { key: "fb.health.failed_count", value: "12" },
];

// the real payload outbound_dedup.py emits, taken from the live VPS test run
const BLOCKED = {
  status: "blocked",
  errorCode: 2022,
  message: "(#2022) คุณถูกบล็อกไม่ให้ใช้คุณสมบัตินี้",
  count: 1,
  firstSeenAt: 1787023260011,
};

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
  $transaction.mockResolvedValue([]);
  sendOpsAlert.mockResolvedValue(true);
});

describe("POST /api/openclaw/fb-alert", () => {
  it("records a block and pages humans on first detection", async () => {
    const res = await POST(request(BLOCKED));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, isNew: true });

    expect(sendOpsAlert).toHaveBeenCalledTimes(1);
    const alert = sendOpsAlert.mock.calls[0][0] as string;
    expect(alert).toContain("Facebook Messenger ส่งข้อความไม่ได้");
    expect(alert).toContain("#2022");

    const written = Object.fromEntries(
      (upsert.mock.calls as { where: { key: string }; create: { value: string } }[][])
        .map((c) => [c[0].where.key, c[0].create.value])
    );
    expect(written["fb.health.status"]).toBe("blocked");
    expect(written["fb.health.code"]).toBe("2022");
  });

  it("does not page again while the same outage is still open", async () => {
    findMany.mockResolvedValue(blockedRows);
    const res = await POST(request({ ...BLOCKED, count: 40 }));
    expect(await res.json()).toMatchObject({ ok: true, isNew: false });
    expect(sendOpsAlert).not.toHaveBeenCalled();
  });

  it("announces recovery only if it was actually blocked", async () => {
    findMany.mockResolvedValue(blockedRows);
    const res = await POST(
      request({ status: "recovered", failedCount: 3902, firstSeenAt: 1787023260011 })
    );
    expect(await res.json()).toMatchObject({ ok: true, wasBlocked: true });
    const alert = sendOpsAlert.mock.calls[0][0] as string;
    expect(alert).toContain("กลับมาส่งได้แล้ว");
    expect(alert).toContain("3902");
  });

  it("stays silent on recovery when nothing was wrong", async () => {
    findMany.mockResolvedValue([{ key: "fb.health.status", value: "ok" }]);
    const res = await POST(request({ status: "recovered", failedCount: 0 }));
    expect(await res.json()).toMatchObject({ ok: true, wasBlocked: false });
    expect(sendOpsAlert).not.toHaveBeenCalled();
  });

  it("rejects an unknown status without touching anything", async () => {
    const res = await POST(request({ status: "whatever" }));
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
    expect(sendOpsAlert).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/openclaw/fb-alert", {
        method: "POST",
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
  });
});
