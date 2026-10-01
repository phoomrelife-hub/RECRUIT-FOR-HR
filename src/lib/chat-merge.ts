// Pure merge/reconcile helpers for the inbox chat. The conversation poll, the
// optimistic send and the POST response all write to the same message list, so
// every write goes through here: merge by id, never replace the whole list, and
// never drop a message the server hasn't confirmed yet.

export type ChatMessageBase = {
  id: string;
  content: string;
  senderType: string;
  senderId?: string | null;
  createdAt: string;
};

/** Local-only delivery state. Server messages have no `pending`. */
export type ChatMessage<T extends ChatMessageBase = ChatMessageBase> = T & {
  /** Stable React key — survives temp id -> server id so the bubble never remounts. */
  clientId?: string;
  pending?: "sending" | "failed";
  error?: string;
};

// Client and server clocks can differ; this only needs to separate "this send"
// from an older identical message ("ok" twice in a row), not be precise.
const MATCH_SKEW_MS = 60_000;

export function messageKey(m: { id: string; clientId?: string }): string {
  return m.clientId ?? m.id;
}

export function makePendingMessage<T extends ChatMessageBase>(
  base: Omit<T, "id" | "createdAt">,
  clientId: string,
  now: Date = new Date(),
): ChatMessage<T> {
  return {
    ...(base as unknown as T),
    id: clientId,
    clientId,
    createdAt: now.toISOString(),
    pending: "sending",
  };
}

/** Real messages by createdAt (stable), then unconfirmed ones in send order. */
function order<T extends ChatMessageBase>(list: ChatMessage<T>[]): ChatMessage<T>[] {
  const real: ChatMessage<T>[] = [];
  const pending: ChatMessage<T>[] = [];
  for (const m of list) (m.pending ? pending : real).push(m);
  real.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  return [...real, ...pending];
}

function sameList<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((m, i) => m === b[i]);
}

function adopt<T extends ChatMessageBase>(server: T, local?: ChatMessage<T>): ChatMessage<T> {
  return local?.clientId ? { ...server, clientId: local.clientId } : { ...server };
}

function sameServerFields(a: ChatMessageBase, b: ChatMessageBase): boolean {
  const x = a as unknown as Record<string, unknown>;
  const y = b as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
  for (const k of keys) {
    if (k === "clientId" || k === "pending" || k === "error") continue;
    if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) return false;
  }
  return true;
}

/**
 * Merge a server snapshot (poll) into local state.
 * - known id: refresh in place (keeps clientId)
 * - matches a still-"sending" temp (poll beat the POST response): adopt it
 * - new id: append
 * - local real messages missing from the snapshot are KEPT (a stale snapshot
 *   must never make a message disappear); pending/failed temps are untouched.
 * Returns `prev` itself when nothing changed so React skips the render.
 */
export function mergeServerMessages<T extends ChatMessageBase>(
  prev: ChatMessage<T>[],
  incoming: T[],
): ChatMessage<T>[] {
  const byId = new Map(prev.map((m) => [m.id, m] as const));
  const claimed = new Set<string>(); // temp ids adopted by a server message
  const next = [...prev];

  for (const server of incoming) {
    const known = byId.get(server.id);
    if (known) {
      if (!sameServerFields(known, server)) {
        const i = next.indexOf(known);
        const merged = adopt(server, known);
        next[i] = merged;
        byId.set(server.id, merged);
      }
      continue;
    }
    const sentAt = new Date(server.createdAt).getTime();
    const temp = next.find(
      (m) =>
        m.pending === "sending" &&
        !claimed.has(m.id) &&
        m.senderType === server.senderType &&
        (m.senderId ?? null) === (server.senderId ?? null) &&
        m.content === server.content &&
        sentAt >= new Date(m.createdAt).getTime() - MATCH_SKEW_MS,
    );
    if (temp) {
      claimed.add(temp.id);
      const merged = adopt(server, temp);
      next[next.indexOf(temp)] = merged;
      byId.set(server.id, merged);
    } else {
      const added = adopt(server);
      next.push(added);
      byId.set(server.id, added);
    }
  }

  const ordered = order(next);
  return sameList(ordered, prev) ? prev : ordered;
}

/** POST succeeded: swap the temp for the saved message, in place (same clientId). */
export function reconcileSent<T extends ChatMessageBase>(
  prev: ChatMessage<T>[],
  clientId: string,
  saved: T,
): ChatMessage<T>[] {
  const temp = prev.find((m) => m.clientId === clientId);
  // A poll may already have added the saved message under its real id.
  const dup = prev.find((m) => m.id === saved.id && m !== temp);
  const merged: ChatMessage<T> = { ...saved, clientId };
  const next: ChatMessage<T>[] = [];
  let placed = false;
  for (const m of prev) {
    if (m === temp || m === dup) {
      if (!placed) {
        next.push(merged);
        placed = true;
      }
      continue;
    }
    next.push(m);
  }
  if (!placed) next.push(merged);
  return order(next);
}

export function markSendFailed<T extends ChatMessageBase>(
  prev: ChatMessage<T>[],
  clientId: string,
  error: string,
): ChatMessage<T>[] {
  return prev.map((m) =>
    m.clientId === clientId && m.pending ? { ...m, pending: "failed" as const, error } : m,
  );
}

export function markSending<T extends ChatMessageBase>(
  prev: ChatMessage<T>[],
  clientId: string,
  now: Date = new Date(),
): ChatMessage<T>[] {
  return order(
    prev.map((m) =>
      m.clientId === clientId && m.pending
        ? { ...m, pending: "sending" as const, error: undefined, createdAt: now.toISOString() }
        : m,
    ),
  );
}

export function removeByClientId<T extends ChatMessageBase>(
  prev: ChatMessage<T>[],
  clientId: string,
): ChatMessage<T>[] {
  return prev.filter((m) => m.clientId !== clientId);
}
