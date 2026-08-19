// Global per-platform bot kill switch.
//
// This sits ABOVE the existing per-conversation `conversation.botEnabled`
// (HR takeover). Off here means the bot stays silent on that whole channel,
// regardless of what any individual conversation says.
//
// Stored in the `settings` table so it survives deploys and is readable by the
// VPS side without a redeploy: middleware.py already asks
// GET /api/openclaw/check-paused before every reply, and that route consults
// this switch — so flipping it here silences LINE too, even though the LINE
// bot itself runs off-box.
//
// Missing row === enabled. A brand-new database must behave exactly like it did
// before this feature existed, so the DEFAULT is always ON and only the literal
// string "false" turns a platform off.
import { db } from "@/lib/db";

export const BOT_PLATFORMS = ["LINE", "FACEBOOK"] as const;
export type BotPlatform = (typeof BOT_PLATFORMS)[number];

export function settingKey(platform: BotPlatform): string {
  return `bot.enabled.${platform.toLowerCase()}`;
}

/** Decide the platform from the id middleware.py hands us. LINE ids start with
 *  "U" and are 33 chars; Facebook PSIDs are all digits. Same rule the
 *  check-paused route already used to pick which candidate column to search. */
export function platformFromExternalId(id: string): BotPlatform {
  return /^\d+$/.test(id) ? "FACEBOOK" : "LINE";
}

/** Interpret a raw settings value. Only the exact string "false" disables. */
export function parseEnabled(value: string | null | undefined): boolean {
  return value !== "false";
}

export async function isPlatformBotEnabled(platform: BotPlatform): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: settingKey(platform) } });
  return parseEnabled(row?.value);
}

export async function getPlatformBotSwitches(): Promise<Record<BotPlatform, boolean>> {
  const rows = await db.setting.findMany({
    where: { key: { in: BOT_PLATFORMS.map(settingKey) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    LINE: parseEnabled(byKey.get(settingKey("LINE"))),
    FACEBOOK: parseEnabled(byKey.get(settingKey("FACEBOOK"))),
  };
}

export async function setPlatformBotEnabled(platform: BotPlatform, enabled: boolean): Promise<void> {
  const key = settingKey(platform);
  const value = enabled ? "true" : "false";
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}
