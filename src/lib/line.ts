import crypto from "crypto";
import { db } from "./db";

const LINE_API      = "https://api.line.me/v2/bot/message";
const LINE_API_ROOT = "https://api.line.me/v2/bot";

async function getCredentials(): Promise<{ secret: string; token: string }> {
  const settings = await db.setting.findMany({
    where: { key: { in: ["line.channel_secret", "line.channel_access_token"] } },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  return {
    secret: map["line.channel_secret"] || process.env.LINE_CHANNEL_SECRET || "",
    token: map["line.channel_access_token"] || process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  };
}

export type LineProfile = {
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
};

export type LineBotInfo = {
  userId: string;
  basicId: string;
  displayName: string;
  pictureUrl?: string;
  chatMode: string;
  markAsReadMode: string;
};

export async function getLineProfile(lineUserId: string): Promise<LineProfile | null> {
  const { token } = await getCredentials();
  if (!token) return null;
  try {
    const res = await fetch(`${LINE_API_ROOT}/profile/${lineUserId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getBotInfo(): Promise<LineBotInfo | null> {
  const { token } = await getCredentials();
  if (!token) return null;
  try {
    const res = await fetch(`${LINE_API_ROOT}/info`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function verifyLineSignature(rawBody: string, signature: string): Promise<boolean> {
  const { secret } = await getCredentials();
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return expected === signature;
}

export async function replyMessage(replyToken: string, text: string): Promise<void> {
  const { token } = await getCredentials();
  await fetch(`${LINE_API}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
}

export type LineQuickReplyItem = {
  label: string; // max 20 chars
  text: string;  // message sent when tapped
};

async function doPush(lineUserId: string, messages: unknown[]): Promise<void> {
  const { token } = await getCredentials();
  if (!token) throw new Error("LINE channel access token not configured");

  const profile = await getLineProfile(lineUserId);
  if (!profile) {
    throw new Error(
      "ผู้ใช้บล็อก OA หรือ lineUserId ไม่ตรงกับ OA ที่ใช้ token นี้ — ตรวจสอบ Channel Access Token ที่ /integrations"
    );
  }

  const res = await fetch(`${LINE_API}/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to: lineUserId, messages }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${body}`);
  }
}

export async function pushMessage(lineUserId: string, text: string): Promise<void> {
  await doPush(lineUserId, [{ type: "text", text }]);
}

/** Push a text message with Quick Reply chips at the bottom */
export async function pushMessageWithQuickReply(
  lineUserId: string,
  text: string,
  quickReplyItems: LineQuickReplyItem[]
): Promise<void> {
  await doPush(lineUserId, [
    {
      type: "text",
      text,
      quickReply: {
        items: quickReplyItems.map((item) => ({
          type: "action",
          action: { type: "message", label: item.label, text: item.text },
        })),
      },
    },
  ]);
}

export type LineMessageEvent = {
  type: string;
  message: { type: string; id: string; text: string };
  source: { type: string; userId: string };
  replyToken: string;
  timestamp: number;
};

export type LineWebhookPayload = {
  destination: string;
  events: LineMessageEvent[];
};
