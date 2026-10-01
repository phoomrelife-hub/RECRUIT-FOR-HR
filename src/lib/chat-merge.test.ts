import { describe, it, expect } from "vitest";
import {
  makePendingMessage,
  mergeServerMessages,
  reconcileSent,
  markSendFailed,
  markSending,
  removeByClientId,
  messageKey,
  type ChatMessage,
  type ChatMessageBase,
} from "./chat-merge";

const srv = (
  id: string,
  content: string,
  at: string,
  senderType = "HR",
  senderId: string | null = "u1",
): ChatMessageBase => ({ id, content, senderType, senderId, createdAt: at });
const T0 = new Date("2026-10-01T10:00:00.000Z");
const pend = (clientId: string, content: string): ChatMessage =>
  makePendingMessage<ChatMessageBase>({ content, senderType: "HR", senderId: "u1" }, clientId, T0);

describe("mergeServerMessages", () => {
  it("returns prev reference when nothing changed", () => {
    const prev: ChatMessage[] = [srv("a", "hi", "2026-10-01T09:00:00Z")];
    expect(mergeServerMessages(prev, [srv("a", "hi", "2026-10-01T09:00:00Z")])).toBe(prev);
  });

  it("a stale snapshot never drops the optimistic bubble (the reported bug)", () => {
    const prev = [srv("a", "hi", "2026-10-01T09:00:00Z"), pend("c1", "hello")];
    const out = mergeServerMessages(prev, [srv("a", "hi", "2026-10-01T09:00:00Z")]);
    expect(out).toBe(prev);
    expect(out.map((m) => m.content)).toEqual(["hi", "hello"]);
  });

  it("a stale snapshot never drops a confirmed message", () => {
    const prev: ChatMessage[] = [srv("a", "hi", "2026-10-01T09:00:00Z"), srv("b", "yo", "2026-10-01T09:01:00Z")];
    const out = mergeServerMessages(prev, [srv("a", "hi", "2026-10-01T09:00:00Z")]);
    expect(out.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("appends new candidate messages in order", () => {
    const prev: ChatMessage[] = [srv("a", "hi", "2026-10-01T09:00:00Z")];
    const out = mergeServerMessages(prev, [
      srv("a", "hi", "2026-10-01T09:00:00Z"),
      srv("c", "q", "2026-10-01T09:05:00Z", "CANDIDATE", null),
    ]);
    expect(out.map((m) => m.id)).toEqual(["a", "c"]);
  });

  it("adopts a sending temp when the poll beats the POST response, keeping its key", () => {
    const out = mergeServerMessages([pend("c1", "hello")], [srv("real1", "hello", "2026-10-01T10:00:01Z")]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("real1");
    expect(out[0].pending).toBeUndefined();
    expect(messageKey(out[0])).toBe("c1");
  });

  it("does not adopt a message older than the send (earlier identical text)", () => {
    const out = mergeServerMessages([pend("c1", "ok")], [srv("old", "ok", "2026-10-01T08:00:00Z")]);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("old");
    expect(out[1].pending).toBe("sending");
  });

  it("two identical sends adopt one server message each, no duplicates", () => {
    const out = mergeServerMessages(
      [pend("c1", "ok"), pend("c2", "ok")],
      [srv("r1", "ok", "2026-10-01T10:00:01Z"), srv("r2", "ok", "2026-10-01T10:00:02Z")],
    );
    expect(out.map((m) => [m.id, m.clientId])).toEqual([
      ["r1", "c1"],
      ["r2", "c2"],
    ]);
  });

  it("never adopts a failed temp", () => {
    const prev = markSendFailed([pend("c1", "hello")], "c1", "boom");
    const out = mergeServerMessages(prev, [srv("r1", "hello", "2026-10-01T10:00:01Z")]);
    expect(out).toHaveLength(2);
  });
});

describe("reconcileSent", () => {
  it("replaces temp in place keeping the clientId", () => {
    const prev: ChatMessage[] = [srv("a", "hi", "2026-10-01T09:00:00Z"), pend("c1", "hello")];
    const out = reconcileSent(prev, "c1", srv("r1", "hello", "2026-10-01T10:00:01Z"));
    expect(out.map((m) => m.id)).toEqual(["a", "r1"]);
    expect(out[1].clientId).toBe("c1");
    expect(out[1].pending).toBeUndefined();
  });

  it("does not duplicate when a poll already adopted the saved message", () => {
    const afterPoll = mergeServerMessages([pend("c1", "hello")], [srv("r1", "hello", "2026-10-01T10:00:01Z")]);
    const out = reconcileSent(afterPoll, "c1", srv("r1", "hello", "2026-10-01T10:00:01Z"));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("r1");
  });

  it("does not duplicate when the real id is present alongside the temp", () => {
    const prev: ChatMessage[] = [pend("c1", "hello"), srv("r1", "hello", "2026-10-01T10:00:01Z")];
    const out = reconcileSent(prev, "c1", srv("r1", "hello", "2026-10-01T10:00:01Z"));
    expect(out).toHaveLength(1);
    expect(out[0].clientId).toBe("c1");
  });
});

describe("failed / retry / remove", () => {
  it("marks failed with an error, retry flips back to sending", () => {
    let list: ChatMessage[] = [pend("c1", "hello"), srv("z", "later", "2026-10-01T10:00:05Z", "CANDIDATE", null)];
    list = markSendFailed(list, "c1", "LINE down");
    expect(list.find((m) => m.clientId === "c1")?.pending).toBe("failed");
    expect(list.find((m) => m.clientId === "c1")?.error).toBe("LINE down");
    list = markSending(list, "c1", new Date("2026-10-01T10:01:00Z"));
    const m = list.find((x) => x.clientId === "c1")!;
    expect(m.pending).toBe("sending");
    expect(m.error).toBeUndefined();
  });

  it("removeByClientId drops only that bubble", () => {
    const out = removeByClientId([pend("c1", "a"), pend("c2", "b")], "c1");
    expect(out.map((m) => m.clientId)).toEqual(["c2"]);
  });
});
