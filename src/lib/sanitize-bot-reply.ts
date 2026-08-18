/**
 * Strips internal source references that AI/RAG systems sometimes leak into responses.
 * Apply to ALL bot replies before saving to DB or sending to LINE.
 *
 * Covers:
 *   Source: SOUL.md#กฎเรื่องอาชีพ
 *   [Source: POSITIONS.md#section]
 *   (Source: RULES.md)
 *   bare SOUL.md / POSITIONS.md / RULES.md mentions
 *   Ref: ... / Reference: ... lines
 *   internal session-manager narration ("ตรวจสอบ session state ก่อนค่ะ")
 */
export function sanitizeBotReply(text: string): string {
  return text
    // full line starting with "Source:" (any capitalisation)
    .replace(/^Source\s*:.*$/gim, "")
    // full line starting with "Ref:" or "Reference:"
    .replace(/^Ref(?:erence)?\s*:.*$/gim, "")
    // bracketed [Source: ...] or [Ref: ...]
    .replace(/\[(?:Source|Ref(?:erence)?)\s*:[^\]]*\]/gi, "")
    // parenthetical (Source: ...) or (Ref: ...)
    .replace(/\((?:Source|Ref(?:erence)?)\s*:[^)]*\)/gi, "")
    // bare .md file references: SOUL.md, POSITIONS.md, RULES.md, CLAUDE.md + optional #anchor
    .replace(/\b(?:SOUL|POSITIONS|RULES|CLAUDE|MEMORY|CONFIG)\.md(?:#\S*)?/gi, "")
    // whole lines that are the bot narrating its own session bookkeeping
    .replace(/^.*\b(?:session[\s_]*(?:state|key|id)|session_manager|sender_id)\b.*$/gim, "")
    // collapse 3+ newlines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * True when a reply is nothing but internal narration — the bot describing its
 * own bookkeeping instead of talking to the candidate.
 *
 * Background: SOUL.md rule #0 tells หลิน to run session_manager.py before every
 * reply. The path in that rule was wrong for ~2 months, so the command failed
 * every time and the model narrated the step to job applicants instead
 * ("ตรวจสอบ session state ก่อนค่ะ"). outbound_dedup.py on the VPS drops these
 * before they reach Messenger; this is the second net, so a leak that somehow
 * arrives never gets stored in the inbox as if it were a real reply.
 */
export function isInternalLeak(text: string): boolean {
  return sanitizeBotReply(text).length === 0 && text.trim().length > 0;
}
