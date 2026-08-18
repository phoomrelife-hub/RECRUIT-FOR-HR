/**
 * The equipment vocabulary, and how to get real form answers into it.
 *
 * The Notion question "อุปกรณ์ที่มีพร้อม (เลือกทั้งหมดที่มี)" is a multi-select,
 * and Notion lets a respondent INVENT an option by typing one. Measured across
 * 500 pages, four values carry essentially all the signal:
 *
 *   สมาร์ตโฟน               328
 *   อินเทอร์เน็ตความเร็วสูง    213
 *   คอมพิวเตอร์/โน้ตบุ๊ก       162
 *   iPad                    157
 *
 * followed by a tail of 15 one-off strings — "Chrome book", "แท็บเล็ต",
 * "มีมือถือ 2 เครื่อง", and one person's email address. So the canonical set is
 * fixed at four, and anything unrecognised is DROPPED rather than stored: an
 * open vocabulary would put "pxh07071900@gmail.com" in a filter dropdown.
 */

export type EquipmentToken = "phone" | "computer" | "tablet" | "internet";

export const EQUIPMENT_TOKENS: EquipmentToken[] = [
  "computer",
  "internet",
  "phone",
  "tablet",
];

export const EQUIPMENT_LABEL: Record<EquipmentToken, string> = {
  computer: "คอมพิวเตอร์/โน้ตบุ๊ก",
  internet: "เน็ตความเร็วสูง",
  phone: "สมาร์ตโฟน",
  tablet: "แท็บเล็ต/iPad",
};

/**
 * Substring patterns, checked in order.
 *
 * Order matters: "โน้ตบุ๊ก" must be tested before any generic tablet match, and
 * "iPad" before "pad", or a laptop answer that also mentions a tablet resolves
 * to the wrong token.
 */
const PATTERNS: Array<[RegExp, EquipmentToken]> = [
  [/คอมพิวเตอร์|โน้?ตบุ๊?ก|notebook|laptop|pc\b|chrome ?book|macbook/i, "computer"],
  [/อินเทอร์เน็ต|internet|wifi|ไวไฟ|เน็ต/i, "internet"],
  [/ipad|ไอแพด|แท็บเล็ต|tablet/i, "tablet"],
  [/สมาร์?ตโฟน|smartphone|โทรศัพท์|มือถือ|iphone|android/i, "phone"],
];

/** One raw multi-select value -> a token, or null if it is noise. */
export function normaliseEquipment(raw: string): EquipmentToken | null {
  const s = raw.trim();
  if (!s || s.length > 60) return null; // a sentence is not an equipment answer
  for (const [re, token] of PATTERNS) if (re.test(s)) return token;
  return null;
}

/** A whole multi-select answer -> a deduped, ordered token set. */
export function normaliseEquipmentList(raw: string[]): EquipmentToken[] {
  const found = new Set<EquipmentToken>();
  for (const r of raw) {
    const t = normaliseEquipment(r);
    if (t) found.add(t);
  }
  return EQUIPMENT_TOKENS.filter((t) => found.has(t));
}

/**
 * Does the candidate meet the brief's equipment requirement?
 *
 * Follows the same rule as every other filter here: an EMPTY candidate list
 * means we never learned what they own, and unknown never rejects. Only a
 * candidate whose equipment we DO know, and which is missing something
 * required, fails.
 */
export function meetsEquipment(
  required: string[],
  candidateHas: string[],
): { passed: boolean; missing: EquipmentToken[] } {
  if (required.length === 0) return { passed: true, missing: [] };
  if (candidateHas.length === 0) return { passed: true, missing: [] };

  const has = new Set(candidateHas);
  const missing = required.filter((r): r is EquipmentToken =>
    EQUIPMENT_TOKENS.includes(r as EquipmentToken) && !has.has(r),
  );
  return { passed: missing.length === 0, missing };
}
