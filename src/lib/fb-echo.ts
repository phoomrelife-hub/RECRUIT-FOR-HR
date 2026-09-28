// Messenger "echo" events — Meta copies every message the Page SENDS back to our
// webhook with `is_echo: true`. That is the only way to see replies HR types
// straight into Meta Business Suite / Page Inbox, which otherwise never reach
// the recruit inbox. (LINE has no equivalent: its webhook is inbound-only.)
//
// Most echoes are messages we already recorded ourselves, so each one is sorted
// by `app_id` — the Meta app whose token sent it:
//   - the VPS bot (outbound_dedup.py) → already saved via /api/openclaw/sync
//   - this app (inbox send, notify.ts) → already saved, or deliberately not
//   - anything else (Business Suite, Page Inbox, the Messenger app) → a person
//     replying outside our inbox: save it as an HR message and pause the bot,
//     exactly like replying from our own inbox does (auto takeover).
// If this app's own id can't be resolved we can't tell our sends from a
// person's, so the echo is dropped — the pre-feature behaviour, never a false
// takeover that would silence the bot.
import { db } from "@/lib/db";
import { getOwnFbAppId, type FbMessage } from "@/lib/facebook";

// "AOM ChatBot" — the app behind the page token in fb_config.json on the VPS.
// Verified 2026-09-28 via Graph GET /app with that token.
const DEFAULT_BOT_APP_IDS = ["946881217956593"];

// Our own sends and bot syncs land within seconds of their echo; this window
// only has to cover that race, not history.
const MATCH_WINDOW_MS = 10 * 60 * 1000;

export type EchoSource = "OURS" | "PAGE_INBOX" | "UNKNOWN";

/** Pure decision: who sent this echo? `ownAppIds` must include this app's own
 *  id — without it every echo from our inbox would look like a person. */
export function classifyEcho(
  appId: string | number | undefined,
  ownAppIds: ReadonlySet<string>,
  ownIdResolved: boolean,
): EchoSource {
  if (appId !== undefined && ownAppIds.has(String(appId))) return "OURS";
  if (!ownIdResolved) return "UNKNOWN";
  return "PAGE_INBOX";
}

/** What to store as the bubble text. Attachments get a placeholder; FB CDN
 *  URLs expire, so they are not kept as mediaUrl. */
export function echoContent(message: FbMessage): string | null {
  const text = message.text?.trim();
  if (text) return text;
  const att = message.attachments?.[0];
  if (!att) return null;
  if (att.type === "image") return "[📷 รูปภาพ]";
  if (att.type === "file") return "[📎 ไฟล์แนบ]";
  if (att.type === "video") return "[🎬 วิดีโอ]";
  if (att.type === "audio") return "[🔊 ข้อความเสียง]";
  return "[📎 ไฟล์แนบ]";
}

export async function resolveOwnAppIds(): Promise<{ ids: Set<string>; ownIdResolved: boolean }> {
  const extra = (process.env.FB_OWN_APP_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ids = new Set([...DEFAULT_BOT_APP_IDS, ...extra]);
  const own = await getOwnFbAppId();
  if (own) ids.add(own);
  return { ids, ownIdResolved: own !== null };
}

/** One log line per echo, so a reply that never reached the inbox can be traced
 *  to the exact branch that skipped it. */
export async function handleFbEcho(psid: string, message: FbMessage, timestamp: number): Promise<void> {
  const outcome = await processEcho(psid, message, timestamp);
  console.log(`[FB echo] app_id=${message.app_id ?? "none"} psid=…${psid.slice(-4)} → ${outcome}`);
}

async function processEcho(psid: string, message: FbMessage, timestamp: number): Promise<string> {
  const { ids, ownIdResolved } = await resolveOwnAppIds();
  const source = classifyEcho(message.app_id, ids, ownIdResolved);
  if (source === "OURS") return "ours, skipped";
  if (source === "UNKNOWN") return "dropped: own app id unresolved";

  const content = echoContent(message);
  if (!content) return "no text or attachment";

  const existing = await db.message.findFirst({ where: { externalId: message.mid } });
  if (existing) return "already stored";

  const candidate = await db.candidate.findUnique({ where: { facebookUserId: psid } });
  if (!candidate) return "no candidate for this psid"; // page wrote first to someone we've never heard from
  const conversation = await db.conversation.findFirst({
    where: { candidateId: candidate.id, status: { not: "CLOSED" } },
  });
  if (!conversation) return "no open conversation";

  // Belt and braces: an outgoing message we saved ourselves with the same text
  // a moment ago is this echo, whatever app_id says. Claim it instead of
  // duplicating it.
  const twin = await db.message.findFirst({
    where: {
      conversationId: conversation.id,
      senderType: { in: ["HR", "BOT"] },
      externalId: null,
      content,
      createdAt: { gte: new Date(Date.now() - MATCH_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (twin) {
    await db.message.update({ where: { id: twin.id }, data: { externalId: message.mid } });
    return "matched a message we already saved";
  }

  // senderId stays null — Meta doesn't say which staff member typed it. The
  // inbox labels HR bubbles without a sender as replied from the Facebook page.
  await db.message.create({
    data: {
      conversationId: conversation.id,
      content,
      senderType: "HR",
      externalId: message.mid,
      createdAt: new Date(timestamp || Date.now()),
    },
  });
  if (conversation.botEnabled) {
    // Same visible marker the inbox takeover leaves, so HR can see why หลิน
    // went quiet and resume it from the inbox.
    await db.message.create({
      data: {
        conversationId: conversation.id,
        content: "HR ตอบจากเพจ Facebook — ปิดบอทในแชทนี้แล้ว",
        senderType: "SYSTEM",
      },
    });
  }
  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), botEnabled: false },
  });
  return "saved as HR reply, bot paused";
}
