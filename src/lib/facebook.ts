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
