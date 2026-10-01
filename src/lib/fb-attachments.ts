// Messenger attachments (a resume sent as PDF/photo). Meta's CDN URLs in the
// webhook expire, so we never store them: each attachment becomes its own inbox
// message whose mediaUrl is our proxy (/api/media/facebook/[mid]?i=N), and the
// proxy asks the Graph API for a fresh URL on every view.
import type { FbMessage } from "@/lib/facebook";

export type FbAttachmentMessage = {
  /** Unique per attachment: the mid for the first, `mid#i` for the rest. */
  externalId: string;
  messageType: "image" | "file" | "video" | "audio";
  content: string;
  /** null for audio/video — the inbox has no player, only a placeholder bubble. */
  mediaUrl: string | null;
};

const PLACEHOLDER = {
  image: "[📷 รูปภาพ]",
  file: "[📎 ไฟล์แนบ]",
  video: "[🎬 วิดีโอ]",
  audio: "[🔊 ข้อความเสียง]",
} as const;

/** One entry per attachment on an inbound Messenger message. */
export function describeFbAttachments(message: FbMessage): FbAttachmentMessage[] {
  const out: FbAttachmentMessage[] = [];
  (message.attachments ?? []).forEach((att, i) => {
    // location / fallback / template carry no downloadable file
    if (!["image", "file", "video", "audio"].includes(att.type)) return;
    const messageType = att.type as FbAttachmentMessage["messageType"];
    const viewable = messageType === "image" || messageType === "file";
    out.push({
      externalId: i === 0 ? message.mid : `${message.mid}#${i}`,
      messageType,
      content: PLACEHOLDER[messageType],
      mediaUrl: viewable ? `/api/media/facebook/${encodeURIComponent(message.mid)}?i=${i}` : null,
    });
  });
  return out;
}
