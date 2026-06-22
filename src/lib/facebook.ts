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

export async function sendFbMessage(recipientId: string, text: string): Promise<void> {
  const { pageAccessToken } = await getCredentials();
  if (!pageAccessToken) throw new Error("Facebook Page Access Token not configured");

  const res = await fetch(`${GRAPH_API}/me/messages?access_token=${pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Facebook send failed: ${res.status} ${err}`);
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FbMessage {
  mid: string;
  text?: string;
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
