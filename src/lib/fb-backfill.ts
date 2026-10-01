// Planning half of the Messenger attachment backfill (scripts/backfill-fb-attachments.ts).
// Pure on purpose: it decides which rows to insert, the script only does I/O.
import { describeFbAttachments } from "@/lib/fb-attachments";

export type GraphMessage = {
  id: string;
  created_time: string;
  from?: { id: string };
  message?: string;
  /** Graph's message edge has no `type` — only a mime type. */
  attachments?: { data?: { mime_type?: string }[] };
};

export type BackfillRow = {
  content: string;
  externalId: string;
  messageType: string;
  mediaUrl: string | null;
  createdAt: Date;
};

/** Rows to insert for one Graph message sent BY the candidate (`psid`).
 *  Ids match what the live webhook would have produced, so a later retry or an
 *  already-saved row is skipped instead of duplicated. */
export function planBackfill(gm: GraphMessage, psid: string, existing: ReadonlySet<string>): BackfillRow[] {
  if (gm.from?.id !== psid) return []; // page / HR messages are not resumes
  const files = gm.attachments?.data ?? [];
  if (files.length === 0) return [];

  const text = gm.message?.trim() || undefined;
  const described = describeFbAttachments({
    mid: gm.id,
    text,
    attachments: files.map((f) => ({ type: f.mime_type?.startsWith("image/") ? "image" : "file" })),
  });
  const createdAt = new Date(gm.created_time);
  return described
    // the webhook gives attachment 0 the bare mid unless a text row already holds it
    .map((a, i) => ({ ...a, externalId: i === 0 && !text ? gm.id : `${gm.id}#${i}` }))
    .filter((a) => !existing.has(a.externalId))
    .map((a) => ({
      content: a.content,
      externalId: a.externalId,
      messageType: a.messageType,
      mediaUrl: a.mediaUrl,
      createdAt,
    }));
}
