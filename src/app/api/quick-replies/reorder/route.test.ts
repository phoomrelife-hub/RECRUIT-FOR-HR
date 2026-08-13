import { beforeEach, describe, expect, it, vi } from "vitest";

// The route pulls auth + db from module scope, so both are stubbed. This keeps the
// test on the logic that can actually break: role gating, duplicate rejection, and
// the id→sortOrder mapping.
const auth = vi.fn();
const update = vi.fn((args: unknown) => args);
const findMany = vi.fn();
const $transaction = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/db", () => ({
  db: {
    quickReply: {
      update: (args: unknown) => update(args),
      findMany: (args: unknown) => findMany(args),
    },
    $transaction: (ops: unknown) => $transaction(ops),
  },
}));

const { PUT } = await import("./route");

const request = (body: unknown) =>
  new Request("http://localhost/api/quick-replies/reorder", {
    method: "PUT",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "u1", role: "HR_MANAGER" } });
  findMany.mockResolvedValue([]);
  $transaction.mockResolvedValue([]);
});

describe("PUT /api/quick-replies/reorder", () => {
  it("rejects HR_STAFF with 403", async () => {
    auth.mockResolvedValue({ user: { id: "u2", role: "HR_STAFF" } });
    const res = await PUT(request({ ids: ["a", "b"] }));
    expect(res.status).toBe(403);
    expect($transaction).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller with 403", async () => {
    auth.mockResolvedValue(null);
    const res = await PUT(request({ ids: ["a"] }));
    expect(res.status).toBe(403);
  });

  it("rejects a malformed body with 400", async () => {
    const res = await PUT(request({ ids: "not-an-array" }));
    expect(res.status).toBe(400);
    expect($transaction).not.toHaveBeenCalled();
  });

  // Duplicates would leave two rows sharing a sortOrder, which is visible: the
  // chat row shows the top 4, so a tie silently changes what HR sees.
  it("rejects duplicate ids with 400", async () => {
    const res = await PUT(request({ ids: ["a", "b", "a"] }));
    expect(res.status).toBe(400);
    expect($transaction).not.toHaveBeenCalled();
  });

  it("writes sortOrder equal to array index, in one transaction", async () => {
    const res = await PUT(request({ ids: ["c", "a", "b"] }));
    expect(res.status).toBe(200);
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenNthCalledWith(1, { where: { id: "c" }, data: { sortOrder: 0 } });
    expect(update).toHaveBeenNthCalledWith(2, { where: { id: "a" }, data: { sortOrder: 1 } });
    expect(update).toHaveBeenNthCalledWith(3, { where: { id: "b" }, data: { sortOrder: 2 } });
  });

  it("returns the reordered list", async () => {
    findMany.mockResolvedValue([{ id: "c", title: "t", content: "x", sortOrder: 0 }]);
    const res = await PUT(request({ ids: ["c"] }));
    await expect(res.json()).resolves.toEqual({
      quickReplies: [{ id: "c", title: "t", content: "x", sortOrder: 0 }],
    });
  });
});
