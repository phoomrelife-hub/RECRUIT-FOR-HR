import { db } from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// Facebook page messaging health.
//
// Between 2026-06-23 and 2026-08-17 Meta blocked the page from sending messages
// (Graph API error #2022). Every bot reply failed for 55 days and nobody noticed,
// because the only trace was a FAIL line in the VPS log. outbound_dedup.py now
// POSTs to /api/openclaw/fb-alert when that happens, and this module is where the
// state lives so the dashboard can show it.
//
// Stored in Setting (key/value) on purpose — no migration, and recruit has a
// single database that IS production.
// ─────────────────────────────────────────────────────────────────────────────

export const FB_HEALTH_KEYS = {
  status: "fb.health.status",
  code: "fb.health.code",
  message: "fb.health.message",
  failedCount: "fb.health.failed_count",
  since: "fb.health.since",
  lastSeen: "fb.health.last_seen",
  recoveredAt: "fb.health.recovered_at",
} as const;

export type FbHealth = {
  blocked: boolean;
  code: number | null;
  message: string | null;
  failedCount: number;
  since: Date | null;
  lastSeen: Date | null;
  recoveredAt: Date | null;
};

const EMPTY: FbHealth = {
  blocked: false,
  code: null,
  message: null,
  failedCount: 0,
  since: null,
  lastSeen: null,
  recoveredAt: null,
};

function toDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getFbHealth(): Promise<FbHealth> {
  const rows = await db.setting.findMany({
    where: { key: { in: Object.values(FB_HEALTH_KEYS) } },
  });
  if (rows.length === 0) return EMPTY;

  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    blocked: map.get(FB_HEALTH_KEYS.status) === "blocked",
    code: map.get(FB_HEALTH_KEYS.code) ? Number(map.get(FB_HEALTH_KEYS.code)) : null,
    message: map.get(FB_HEALTH_KEYS.message) ?? null,
    failedCount: Number(map.get(FB_HEALTH_KEYS.failedCount) ?? "0") || 0,
    since: toDate(map.get(FB_HEALTH_KEYS.since)),
    lastSeen: toDate(map.get(FB_HEALTH_KEYS.lastSeen)),
    recoveredAt: toDate(map.get(FB_HEALTH_KEYS.recoveredAt)),
  };
}

async function writeSettings(entries: Record<string, string>) {
  await db.$transaction(
    Object.entries(entries).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
}

/** outbound_dedup.py reported that Meta is refusing sends page-wide. */
export async function recordFbBlocked(input: {
  code: number;
  message: string;
  count: number;
  firstSeenAt: Date;
}): Promise<{ isNew: boolean }> {
  const prev = await getFbHealth();
  await writeSettings({
    [FB_HEALTH_KEYS.status]: "blocked",
    [FB_HEALTH_KEYS.code]: String(input.code),
    [FB_HEALTH_KEYS.message]: input.message.slice(0, 500),
    [FB_HEALTH_KEYS.failedCount]: String(input.count),
    [FB_HEALTH_KEYS.since]: input.firstSeenAt.toISOString(),
    [FB_HEALTH_KEYS.lastSeen]: new Date().toISOString(),
  });
  return { isNew: !prev.blocked };
}

/** A send succeeded again after a block. */
export async function recordFbRecovered(input: {
  failedCount: number;
  firstSeenAt: Date;
}): Promise<{ wasBlocked: boolean; outageMinutes: number }> {
  const prev = await getFbHealth();
  const now = new Date();
  await writeSettings({
    [FB_HEALTH_KEYS.status]: "ok",
    [FB_HEALTH_KEYS.failedCount]: String(input.failedCount),
    [FB_HEALTH_KEYS.recoveredAt]: now.toISOString(),
    [FB_HEALTH_KEYS.lastSeen]: now.toISOString(),
  });
  const start = prev.since ?? input.firstSeenAt;
  return {
    wasBlocked: prev.blocked,
    outageMinutes: Math.max(0, Math.round((now.getTime() - start.getTime()) / 60000)),
  };
}
