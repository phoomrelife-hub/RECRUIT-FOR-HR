// Channel-aware outbound messaging to a candidate.
// Picks the right transport from the candidate's stored ids:
//   - Facebook PSID  → Graph API (sendFbMessage), with an optional message tag
//   - LINE userId    → LINE push
// Facebook is preferred when a PSID is present (a candidate normally has one id).
import { pushMessage, pushMessageWithQuickReply, type LineQuickReplyItem } from "@/lib/line";
import { sendFbMessage, sendFbMessageWithQuickReplies, type FbMessageTag } from "@/lib/facebook";

export type NotifyRecipient = {
  lineUserId?: string | null;
  facebookUserId?: string | null;
};

export type NotifyChannel = "LINE" | "FACEBOOK" | null;

// Note: Facebook sends try RESPONSE first (works within the 24h window with no
// special permission). A `fbTag` is only used as a fallback when the window has
// closed — and most legacy tags (e.g. ACCOUNT_UPDATE) are now deprecated by Meta,
// so reliable out-of-window delivery needs App Review + the HUMAN_AGENT feature.

/** Send a plain text message to a candidate on whichever channel they use. */
export async function notifyCandidate(
  c: NotifyRecipient,
  text: string,
  opts?: { fbTag?: FbMessageTag },
): Promise<NotifyChannel> {
  if (c.facebookUserId) {
    await sendFbMessage(c.facebookUserId, text, opts?.fbTag);
    return "FACEBOOK";
  }
  if (c.lineUserId) {
    await pushMessage(c.lineUserId, text);
    return "LINE";
  }
  return null;
}

/** Send text + quick-reply chips (e.g. สะดวก / ไม่สะดวก) on the candidate's channel. */
export async function notifyCandidateWithQuickReply(
  c: NotifyRecipient,
  text: string,
  items: LineQuickReplyItem[],
  opts?: { fbTag?: FbMessageTag },
): Promise<NotifyChannel> {
  if (c.facebookUserId) {
    await sendFbMessageWithQuickReplies(c.facebookUserId, text, items, opts?.fbTag);
    return "FACEBOOK";
  }
  if (c.lineUserId) {
    await pushMessageWithQuickReply(c.lineUserId, text, items);
    return "LINE";
  }
  return null;
}
