/**
 * One-time backfill: resumes/photos candidates sent on Messenger BEFORE the
 * webhook learned to save attachments (they were silently dropped).
 *
 * Reads the page's Messenger history from the Graph API and inserts the missing
 * attachment messages. Files open through /api/media/facebook/[mid] (fresh URL
 * per view), so nothing expiring is stored.
 *
 * DRY-RUN by default — prints what it would add and writes nothing.
 *
 *   npx tsx scripts/backfill-fb-attachments.ts                  # dry-run, last 90 days
 *   npx tsx scripts/backfill-fb-attachments.ts --since-days 365 # wider window
 *   npx tsx scripts/backfill-fb-attachments.ts --apply          # write
 *
 * Throttled (one Graph request per THROTTLE_MS) and the request count is
 * printed at the end. Needs DATABASE_URL (+ page token in Setting or env).
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import * as dotenv from "dotenv";
import path from "path";
import { planBackfill, type GraphMessage, type BackfillRow } from "../src/lib/fb-backfill";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const GRAPH = "https://graph.facebook.com/v21.0";
const THROTTLE_MS = 400;

const apply = process.argv.includes("--apply");
const sinceIdx = process.argv.indexOf("--since-days");
const sinceDays = sinceIdx > -1 ? Number(process.argv[sinceIdx + 1]) : 90;
const since = new Date(Date.now() - sinceDays * 86_400_000);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) } as never);

let requests = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let token = "";
async function graph<T>(url: string): Promise<T> {
  await sleep(THROTTLE_MS);
  requests++;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Graph ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

type Paged<T> = { data?: T[]; paging?: { next?: string } };
type Conversation = { id: string; updated_time: string; participants?: { data?: { id: string; name?: string }[] } };

async function main() {
  const setting = await db.setting.findUnique({ where: { key: "facebook.page_access_token" } });
  token = setting?.value || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";
  if (!token) throw new Error("No Facebook page access token (Setting facebook.page_access_token or env)");

  const { id: pageId } = await graph<{ id: string }>(`${GRAPH}/me?fields=id&access_token=${token}`);
  console.log(`${apply ? "APPLY" : "DRY-RUN"} — page ${pageId}, window since ${since.toISOString().slice(0, 10)}`);

  let convUrl: string | undefined =
    `${GRAPH}/me/conversations?fields=id,updated_time,participants&limit=50&access_token=${token}`;
  let scanned = 0;
  let planned = 0;
  let written = 0;
  const perCandidate: string[] = [];

  while (convUrl) {
    const page: Paged<Conversation> = await graph(convUrl);
    for (const conv of page.data ?? []) {
      // conversations come newest-first; once one is older than the window, the rest are too
      if (new Date(conv.updated_time) < since) { convUrl = undefined; break; }
      scanned++;
      const person = conv.participants?.data?.find((p) => p.id !== pageId);
      if (!person) continue;

      const rows = await collectRows(conv.id, person.id);
      if (rows.length === 0) continue;
      planned += rows.length;
      perCandidate.push(`${person.name ?? person.id}: ${rows.length}`);
      if (apply) written += await save(person, rows);
    }
    if (convUrl) convUrl = page.paging?.next;
  }

  console.log(`\nconversations scanned: ${scanned}`);
  console.log(`attachment messages ${apply ? "inserted" : "that would be inserted"}: ${apply ? written : planned}`);
  perCandidate.forEach((l) => console.log("  " + l));
  console.log(`Graph requests: ${requests}`);
  if (!apply && planned > 0) console.log("\nRe-run with --apply to write.");
}

async function collectRows(convId: string, psid: string): Promise<BackfillRow[]> {
  const fields = "id,created_time,from,message,attachments{mime_type}";
  let url: string | undefined = `${GRAPH}/${convId}/messages?fields=${encodeURIComponent(fields)}&limit=50&access_token=${token}`;
  const all: GraphMessage[] = [];
  while (url) {
    const page: Paged<GraphMessage> = await graph(url);
    const batch = page.data ?? [];
    all.push(...batch);
    // newest-first: stop once the page is entirely older than the window
    const oldest = batch.at(-1);
    url = oldest && new Date(oldest.created_time) < since ? undefined : page.paging?.next;
  }
  const inWindow = all.filter((m) => new Date(m.created_time) >= since);
  const existing = new Set(
    (await db.message.findMany({
      where: { externalId: { in: inWindow.flatMap((m) => [m.id, `${m.id}#0`, `${m.id}#1`, `${m.id}#2`, `${m.id}#3`]) } },
      select: { externalId: true },
    })).map((m: { externalId: string | null }) => m.externalId as string),
  );
  return inWindow.flatMap((m) => planBackfill(m, psid, existing));
}

async function save(person: { id: string; name?: string }, rows: BackfillRow[]): Promise<number> {
  let candidate = await db.candidate.findUnique({ where: { facebookUserId: person.id } });
  if (!candidate) {
    // sent only files, never text — the webhook never created them
    candidate = await db.candidate.create({
      data: {
        nickname: person.name || "Facebook User",
        facebookUserId: person.id,
        sourceChannel: "FACEBOOK",
        currentStatus: "NEW_APPLICANT",
      },
    });
  }
  let conversation = await db.conversation.findFirst({ where: { candidateId: candidate.id, status: { not: "CLOSED" } } });
  if (!conversation) {
    conversation = await db.conversation.create({ data: { candidateId: candidate.id, channel: "FACEBOOK", botEnabled: true } });
  }
  const res = await db.message.createMany({
    data: rows.map((r) => ({ ...r, conversationId: conversation!.id, senderType: "CANDIDATE" as const })),
  });
  const newest = rows.reduce((a, r) => (r.createdAt > a ? r.createdAt : a), rows[0].createdAt);
  if (!conversation.lastMessageAt || conversation.lastMessageAt < newest) {
    await db.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: newest } });
  }
  return res.count;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); await pool.end(); });
