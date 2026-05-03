import { db } from "./db";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const GROUP_ID = process.env.TELEGRAM_GROUP_ID ?? "-1003770931529";
const TOPIC_ID = parseInt(process.env.TELEGRAM_TOPIC_ID ?? "522");
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ส่งข้อความของ candidate ไปให้ Daniel-HR ใน Telegram
// คืน telegram message_id เพื่อใช้ match reply ทีหลัง
export async function sendToDanielHR(
  lineUserId: string,
  candidateName: string,
  message: string,
  conversationId: string
): Promise<number | null> {
  if (!BOT_TOKEN) return null;

  const text =
    `📩 LINE | ${lineUserId}\n` +
    `👤 ${candidateName}\n` +
    `─────────────────\n` +
    `${message}`;

  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: GROUP_ID,
        message_thread_id: TOPIC_ID,
        text,
      }),
    });
    const data = await res.json();
    if (!data.ok) return null;

    const msgId: number = data.result.message_id;

    // เก็บ mapping: telegram_message_id → lineUserId|conversationId
    await db.setting.upsert({
      where: { key: `tg_reply.${msgId}` },
      update: { value: `${lineUserId}|${conversationId}` },
      create: { key: `tg_reply.${msgId}`, value: `${lineUserId}|${conversationId}` },
    });

    return msgId;
  } catch {
    return null;
  }
}

// ตั้ง Telegram webhook ให้ชี้มาที่ recruit system (เรียกครั้งเดียวตอน setup)
export async function setTelegramWebhook(webhookUrl: string): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  const res = await fetch(`${TG_API}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
  });
  const data = await res.json();
  return data.ok === true;
}

export async function getTelegramWebhookInfo(): Promise<{ url: string; pending: number } | null> {
  if (!BOT_TOKEN) return null;
  const res = await fetch(`${TG_API}/getWebhookInfo`);
  const data = await res.json();
  if (!data.ok) return null;
  return { url: data.result.url ?? "", pending: data.result.pending_update_count ?? 0 };
}
