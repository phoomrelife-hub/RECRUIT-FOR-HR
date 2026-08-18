/**
 * Strip protected personal attributes from the FREE-TEXT half of a brief.
 *
 * This is not a ban on filtering by age — HR can and does, and `HiringBrief`
 * has `minAge`/`maxAge` columns for exactly that. It is a ban on letting an
 * age requirement reach the MODEL as prose.
 *
 * The failure this prevents, observed live on 2026-08-17 in the ERP build:
 * HR wrote "อยากได้ Sales admin ที่ อายุ 20 - 40 ปี", the phrase landed in the
 * model's criteria list, and the model — which is deliberately never shown a
 * candidate's age — wrote "ยังขาดข้อมูลสำคัญเรื่องอายุ" and marked every
 * candidate down for a gap that was by design.
 *
 * So: age/salary/work-preference go to SQL, where they are checkable, and are
 * removed from anything the model reads. A requirement the evidence cannot
 * speak to only ever subtracts.
 */

/** Spans naming an attribute the model must not see. Longest-first. */
const PROTECTED_PATTERNS: RegExp[] = [
  // Thai — age
  /อายุ\s*(ไม่เกิน|ตั้งแต่|ระหว่าง|มากกว่า|น้อยกว่า)?\s*\d+\s*(?:[-–—]|ถึง)*\s*\d*\s*(?:ปี)?/g,
  /ช่วงอายุ\s*\d+\s*(?:[-–—]|ถึง)*\s*\d*\s*(?:ปี)?/g,
  // Thai — gender
  /เพศ\s*(ชาย|หญิง|ทางเลือก|ใดก็ได้)?/g,
  /(?:^|\s)(ผู้ชาย|ผู้หญิง|สุภาพสตรี|สุภาพบุรุษ)(?=\s|$)/g,
  // Thai — religion, marital status, children
  /ศาสนา\s*\S*/g,
  /สถานภาพ(?:สมรส)?\s*\S*/g,
  /(?:^|\s)(โสด|สมรสแล้ว|แต่งงานแล้ว)(?=\s|$)/g,
  /(?:มี)?บุตร\s*\d*\s*(?:คน)?/g,
  // English
  /\bage[d]?\s*:?\s*\d+\s*(?:[-–—]\s*\d+)?\b/gi,
  /\b\d+\s*[-–—]\s*\d+\s*(?:years?\s*old|yrs?\s*old)\b/gi,
  /\b(male|female|gender|religion|married|single|divorced)\b/gi,
];

/** Tidy punctuation and dangling connectives left behind by a cut. */
function tidy(s: string): string {
  return s
    .replace(/\s*([,;:·|])\s*(?=[,;:·|]|$)/g, "")
    .replace(/\s*\(\s*\)\s*/g, " ")
    .replace(/(?:^|\s)(ที่|และ|หรือ|กับ)\s*(?=$|[,;])/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:·|\-–—]+|[\s,;:·|\-–—]+$/g, "")
    .trim();
}

export function containsProtectedAttribute(text: string): boolean {
  return PROTECTED_PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

/**
 * Remove protected spans, keeping the rest of the sentence.
 *
 * "อยากได้ Sales admin ที่ อายุ 20 - 40 ปี" -> "อยากได้ Sales admin"
 * Dropping the whole line would delete the only real requirement in it.
 */
export function redactProtected(text: string): string {
  if (!text) return "";
  let out = text;
  for (const re of PROTECTED_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, " ");
  }
  return tidy(out);
}

/**
 * Redact each criterion, dropping any that was ONLY about a protected
 * attribute. "อายุ 20-40 ปี" reduces to nothing and must disappear rather than
 * survive as an empty bullet the model tries to interpret.
 */
export function redactCriteria<T extends { name: string; description: string }>(
  items: T[],
): T[] {
  const out: T[] = [];
  for (const item of items) {
    const name = redactProtected(item.name);
    // The length guard applies ONLY when a redaction actually cut something —
    // it is there to drop residue ("อายุ 20-40 ปี" -> ""), not to police how
    // short a legitimate criterion name may be.
    const wasCut = name !== item.name.trim();
    if (!name || (wasCut && name.length <= 2)) continue;
    out.push({ ...item, name, description: redactProtected(item.description) });
  }
  return out;
}
