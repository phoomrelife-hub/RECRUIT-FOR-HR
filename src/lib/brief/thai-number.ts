/**
 * Parse money and year figures out of free-text Thai form answers.
 *
 * The Notion form collects these as TEXT, not numbers, so real answers look
 * like: "9,000 บาทต่อเดือน", "30,000+", "สูงสุดเคยทำได้ 1 ล้านบาท",
 * "15000-18000", "แล้วแต่บริษัท". A naive parseInt reads the first digits it
 * finds and would turn "1 ล้านบาท" into 1 — off by a factor of a million, in a
 * field HR filters on.
 */

/** Thai scale words, largest first so "ล้าน" is consumed before "หมื่น". */
const SCALES: Array<[RegExp, number]> = [
  [/ล้าน/, 1_000_000],
  [/แสน/, 100_000],
  [/หมื่น/, 10_000],
  [/พัน/, 1_000],
];

/** Phrases that mean "no figure given" and must yield null, never 0. */
const NON_ANSWERS =
  /(แล้วแต่|ตามโครงสร้าง|ตามตกลง|ต่อรอง|ไม่ระบุ|ไม่เคย|ยังไม่|ไม่มี|n\/?a|-{1,}$)/i;

/**
 * Extract a monetary amount.
 *
 * Returns the LOWEST figure when a range is given ("15000-18000" -> 15000):
 * for an expected salary that is what the candidate will actually accept, and
 * for a sales record it is the conservative reading.
 */
export function parseThaiAmount(text: string | null | undefined): number | null {
  if (!text) return null;
  const s = text.trim();
  if (!s || NON_ANSWERS.test(s)) return null;

  // Scale words first: "1 ล้าน", "5 แสน", "ล้านกว่า".
  for (const [re, mult] of SCALES) {
    const m = s.match(new RegExp(`([\\d.,]+)?\\s*${re.source}`));
    if (!m) continue;
    const lead = m[1] ? Number(m[1].replace(/,/g, "")) : 1;
    if (Number.isFinite(lead) && lead > 0) return Math.round(lead * mult);
  }

  // Plain numbers, commas stripped. Take the smallest of a range.
  const nums = (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? [])
    .map((n) => Number(n.replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return null;

  // Guard against a year or a phone number leaking in as an amount.
  const plausible = nums.filter((n) => n >= 1000 && n <= 100_000_000);
  if (plausible.length === 0) return null;
  return Math.round(Math.min(...plausible));
}

/**
 * Extract years of experience from a prose answer.
 *
 * "6 ปี เคยขายอุปกรณ์เครื่องครัว..." -> 6
 * "มีประสบการขาย 2 ปี สินค้าเป็นผัก-ผลไม้" -> 2
 *
 * Months are converted so "8 เดือน" does not read as 8 years. An explicit
 * "ไม่มีประสบการณ์" is 0 — a real answer, distinct from null.
 */
export function parseExperienceYears(text: string | null | undefined): number | null {
  if (!text) return null;
  const s = text.trim();
  if (!s) return null;

  if (/(ไม่มีประสบการณ์|ไม่เคยทำงาน|เพิ่งจบ|ยังไม่มีประสบการณ์|no experience)/i.test(s)) {
    return 0;
  }

  // "2 ปีครึ่ง" -> 2.5 -> rounds to 3; good enough for a >= filter.
  const yearMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*ปี(ครึ่ง)?/);
  if (yearMatch) {
    const n = Number(yearMatch[1]) + (yearMatch[2] ? 0.5 : 0);
    if (Number.isFinite(n) && n >= 0 && n <= 60) return Math.round(n);
  }

  const monthMatch = s.match(/(\d+)\s*เดือน/);
  if (monthMatch) {
    const months = Number(monthMatch[1]);
    if (Number.isFinite(months) && months >= 0) return Math.round(months / 12);
  }

  return null;
}
