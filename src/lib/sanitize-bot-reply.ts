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
    // collapse 3+ newlines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
