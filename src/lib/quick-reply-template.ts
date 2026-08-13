/**
 * Quick reply templates may contain Thai placeholders that resolve against the
 * candidate in the open conversation. An unresolved placeholder collapses to an
 * empty string — never to literal braces, because the result is sent to a real
 * candidate over LINE and "สวัสดีคุณ{{ชื่อเล่น}}" reads worse than any typo.
 */

export type TemplateCandidate = {
  fullName?: string | null;
  nickname?: string | null;
  positionTitle?: string | null;
};

export const TEMPLATE_PLACEHOLDERS = ["{{ชื่อ}}", "{{ชื่อเล่น}}", "{{ตำแหน่ง}}"] as const;

/**
 * How many templates show as always-visible chips above the chat composer.
 * Lives here because both the inbox chip row and the management page's
 * "these show in chat" divider must agree on it.
 */
export const VISIBLE_CHIP_COUNT = 4;

/**
 * Matches placeholders with two or more braces on each side (e.g. {{ }}, {{{ }}}, etc.).
 * Requiring 2+ braces prevents surplus braces from leaking to output. The [^{}] class
 * ensures no braces are captured in the key, so even with mismatched brace counts,
 * the replacement always consumes all braces and produces clean output.
 * Unclosed placeholders (e.g. {{ชื่อ without closing braces) are deliberately left
 * as literal text — HR reviews the resolved template in the composer before sending.
 */
const PLACEHOLDER_PATTERN = /\{\{+\s*([^{}]*?)\s*\}\}+/g;

export function applyTemplate(content: string, candidate: TemplateCandidate): string {
  return content.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    switch (key) {
      case "ชื่อ":
        return candidate.fullName ?? "";
      case "ชื่อเล่น":
        return candidate.nickname ?? "";
      case "ตำแหน่ง":
        return candidate.positionTitle ?? "";
      default:
        return "";
    }
  });
}
