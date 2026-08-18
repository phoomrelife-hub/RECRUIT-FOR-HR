/**
 * Remove contact details from a chat transcript before the model reads it.
 *
 * Name / phone / LINE ID are already known and already in Notion — the model
 * has no use for them, and they cannot inform a hiring judgement. Keeping them
 * out is structural rather than a prompt instruction, so it holds even when the
 * model is swapped or the prompt is edited.
 *
 * The digit thresholds matter: Thai mobile numbers are 9-10 digits, while the
 * numbers this pipeline NEEDS to read — age (2), expected salary (4-6), monthly
 * sales (5-8) — are all shorter. Scrubbing at 9+ removes contact details
 * without eating the evidence.
 */

const PATTERNS: Array<[RegExp, string]> = [
  // Email first: it contains no long digit runs, so order is not load-bearing,
  // but doing it early keeps the replacement text clean.
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, "[อีเมล]"],
  // LINE / social handles introduced by a label.
  [/(?:line|ไลน์|ไอดีไลน์|id)\s*(?:id)?\s*[:：]?\s*[@]?[\w.-]{3,}/gi, "[ไอดีไลน์]"],
  // Phone numbers: 9-10 digits, tolerating -, space or . as separators.
  [/(?:\+?66|0)[\d\s.-]{8,12}\d/g, "[เบอร์โทร]"],
  // Any bare run of 9+ digits that survived the above.
  [/\b\d{9,}\b/g, "[ตัวเลขยาว]"],
];

export function scrubContacts(text: string): string {
  let out = text;
  for (const [re, replacement] of PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, replacement);
  }
  return out;
}
