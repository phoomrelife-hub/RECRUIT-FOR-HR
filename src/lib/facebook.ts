import { db } from "@/lib/db";
import crypto from "crypto";

const GRAPH_API = "https://graph.facebook.com/v21.0";

// ─── Credentials ────────────────────────────────────────────────────────────

async function getCredentials() {
  const settings = await db.setting.findMany({
    where: { key: { in: ["facebook.page_access_token", "facebook.app_secret", "facebook.verify_token"] } },
  });
  const get = (k: string) => settings.find((s) => s.key === k)?.value ?? "";

  return {
    pageAccessToken: get("facebook.page_access_token") || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "",
    appSecret: get("facebook.app_secret") || process.env.FACEBOOK_APP_SECRET || "",
    verifyToken: get("facebook.verify_token") || process.env.FACEBOOK_VERIFY_TOKEN || "",
  };
}

// ─── Signature verification ──────────────────────────────────────────────────

export async function verifyFbSignature(rawBody: string, signature: string): Promise<boolean> {
  const { appSecret } = await getCredentials();
  if (!appSecret) return false;

  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function getVerifyToken(): Promise<string> {
  const { verifyToken } = await getCredentials();
  return verifyToken;
}

// ─── User profile ────────────────────────────────────────────────────────────

export type FbProfile = {
  name: string;
  profilePicUrl?: string;
};

/**
 * Fetch a Messenger user's profile by PSID via the Graph API.
 * Works for people who have messaged the Page (page-scoped). Returns null on
 * any failure so the caller can fall back to a default name.
 */
export async function getFbProfile(psid: string): Promise<FbProfile | null> {
  const { pageAccessToken } = await getCredentials();
  if (!pageAccessToken) return null;

  // ① User Profile API — gives name + profile_pic, but requires Advanced Access
  //    (pages_messaging App Review). Fails with code 100/subcode 33 in dev mode.
  try {
    const res = await fetch(
      `${GRAPH_API}/${psid}?fields=first_name,last_name,profile_pic&access_token=${pageAccessToken}`
    );
    if (res.ok) {
      const data = (await res.json()) as {
        first_name?: string;
        last_name?: string;
        profile_pic?: string;
      };
      const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
      if (name || data.profile_pic) return { name, profilePicUrl: data.profile_pic };
    }
  } catch {
    /* fall through to conversations lookup */
  }

  // ② Fallback — Conversations API (page inbox). Returns the participant's name
  //    for Page admins WITHOUT App Review. No profile picture available this way.
  try {
    const res = await fetch(
      `${GRAPH_API}/me/conversations?user_id=${psid}&fields=participants&access_token=${pageAccessToken}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: { participants?: { data?: { id: string; name?: string }[] } }[];
    };
    const participant = data.data?.[0]?.participants?.data?.find((p) => p.id === psid);
    if (participant?.name) return { name: participant.name };
    return null;
  } catch {
    return null;
  }
}

// ─── Send message ────────────────────────────────────────────────────────────

// Optional Messenger message tag. Needed to message a user outside the 24-hour
// window (e.g. qualify result / interview invite sent days later). ACCOUNT_UPDATE
// covers application-status updates; without a tag Meta only allows RESPONSE
// within 24h of the user's last message.
export type FbMessageTag = "ACCOUNT_UPDATE" | "CONFIRMED_EVENT_UPDATE" | "POST_PURCHASE_UPDATE" | "HUMAN_AGENT";

type FbQuickReplyItem = { label: string; text: string };

async function rawSendFb(token: string, recipientId: string, message: unknown, extra: object): Promise<Response> {
  return fetch(`${GRAPH_API}/me/messages?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message, ...extra }),
  });
}

async function postFbMessage(recipientId: string, message: unknown, tag?: FbMessageTag): Promise<void> {
  const { pageAccessToken } = await getCredentials();
  if (!pageAccessToken) throw new Error("Facebook Page Access Token not configured");

  // Always try RESPONSE first — it works for anyone within the 24h window and
  // needs no special permission. Only if that fails because the window has
  // closed do we retry with a message tag (which requires App Review and a
  // currently-supported tag; ACCOUNT_UPDATE is deprecated by Meta).
  const res = await rawSendFb(pageAccessToken, recipientId, message, { messaging_type: "RESPONSE" });
  if (res.ok) return;

  const err = await res.text();
  const outsideWindow = /outside.*allowed window|2018278|messaging window|24-hour|24 hour/i.test(err);
  if (tag && outsideWindow) {
    const res2 = await rawSendFb(pageAccessToken, recipientId, message, { messaging_type: "MESSAGE_TAG", tag });
    if (res2.ok) return;
    throw new Error(`Facebook send failed (tag ${tag}): ${res2.status} ${await res2.text()}`);
  }
  throw new Error(`Facebook send failed: ${res.status} ${err}`);
}

export async function sendFbMessage(recipientId: string, text: string, tag?: FbMessageTag): Promise<void> {
  await postFbMessage(recipientId, { text }, tag);
}

/** Send text with Messenger quick-reply chips (e.g. สะดวก / ไม่สะดวก). */
export async function sendFbMessageWithQuickReplies(
  recipientId: string,
  text: string,
  items: FbQuickReplyItem[],
  tag?: FbMessageTag,
): Promise<void> {
  await postFbMessage(
    recipientId,
    {
      text,
      quick_replies: items.map((it) => ({
        content_type: "text",
        title: it.label.slice(0, 20),
        payload: it.text,
      })),
    },
    tag,
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FbMessage {
  mid: string;
  text?: string;
  is_echo?: boolean;
  quick_reply?: { payload: string };
}

export interface FbMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: FbMessage;
  postback?: { title: string; payload: string };
}

export interface FbWebhookEntry {
  id: string;
  time: number;
  messaging: FbMessagingEvent[];
}

export interface FbWebhookPayload {
  object: string;
  entry: FbWebhookEntry[];
}
