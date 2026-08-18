import { createHmac } from "node:crypto";

/**
 * Lark custom-bot webhook client.
 *
 * Send-only by design. A Lark custom bot cannot receive interactions, so cards
 * carry a link back into the app rather than action buttons — a "shortlist"
 * button on the card would look clickable and do nothing.
 */

export interface LarkResult {
  ok: boolean;
  /** Populated on failure so the caller can log why without re-reading Lark docs. */
  error?: string;
}

/**
 * Lark signs with the TIMESTAMP as the message and the secret as the key —
 * the reverse of most webhook schemes, and the usual reason a signature is
 * rejected with a correct secret.
 */
function sign(timestamp: number, secret: string): string {
  return createHmac("sha256", `${timestamp}\n${secret}`).update("").digest("base64");
}

async function post(body: Record<string, unknown>): Promise<LarkResult> {
  const url = process.env.LARK_RECRUIT_WEBHOOK;
  if (!url) return { ok: false, error: "LARK_RECRUIT_WEBHOOK is not set" };

  const payload: Record<string, unknown> = { ...body };
  const secret = process.env.LARK_RECRUIT_SECRET;
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    payload.timestamp = String(timestamp);
    payload.sign = sign(timestamp, secret);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    // Lark answers 200 with a non-zero `code` on failure, so HTTP status alone
    // is not enough to call this a success.
    if (json?.code && json.code !== 0) {
      return { ok: false, error: `lark code ${json.code}: ${json.msg ?? ""}` };
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface MatchCardCandidate {
  name: string;
  stars: number;
  why: string;
  url: string;
}

const STAR_ROW = (n: number) => "⭐".repeat(Math.max(0, Math.min(5, n)));

/** A single high-scoring candidate, sent the moment they are found. */
export function buildInstantCard(positionTitle: string, c: MatchCardCandidate) {
  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: "green",
        title: { tag: "plain_text", content: `ผู้สมัครน่าสนใจ — ${positionTitle}` },
      },
      elements: [
        {
          tag: "div",
          text: { tag: "lark_md", content: `**${c.name}**  ${STAR_ROW(c.stars)}` },
        },
        { tag: "div", text: { tag: "lark_md", content: c.why || "—" } },
        {
          tag: "action",
          actions: [
            {
              tag: "button",
              text: { tag: "plain_text", content: "เปิดดูโปรไฟล์" },
              type: "primary",
              url: c.url,
            },
          ],
        },
      ],
    },
  };
}

/** The once-a-day roll-up of everyone below the instant threshold. */
export function buildDigestCard(
  positionTitle: string,
  candidates: MatchCardCandidate[],
  listUrl: string,
) {
  const lines = candidates
    .map((c) => `${STAR_ROW(c.stars)} [${c.name}](${c.url})\n${c.why || "—"}`)
    .join("\n\n");

  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: "blue",
        title: {
          tag: "plain_text",
          content: `สรุปผู้สมัครวันนี้ — ${positionTitle} (${candidates.length} คน)`,
        },
      },
      elements: [
        { tag: "div", text: { tag: "lark_md", content: lines || "ไม่มีผู้สมัครใหม่" } },
        { tag: "hr" },
        {
          tag: "action",
          actions: [
            {
              tag: "button",
              text: { tag: "plain_text", content: "ดูทั้งหมด" },
              type: "default",
              url: listUrl,
            },
          ],
        },
      ],
    },
  };
}

export async function sendLark(card: Record<string, unknown>): Promise<LarkResult> {
  return post(card);
}
