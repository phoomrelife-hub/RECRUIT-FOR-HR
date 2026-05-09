/**
 * Parse free-text experience answers from the Sales Admin Google Form into
 * one of four experience tiers.
 *
 * Examples from real form data:
 *   "ต่ำกว่า 1 ปี ที่เกี่ยวกับการขาย..."      → low
 *   "6 เดือน+ โทรศัพท์มือถือ แบรนด์ต่างๆ"    → low
 *   "2 ปีขายเครื่องนอน เฟอร์นิเจอร์"          → mid
 *   "3"                                          → mid  (bare number treated as years)
 *   "3-4ปี เครื่องปรับอากาศ"                   → high (max 4 > 3)
 *   "5ปี ขายของออนไลน์ เสื้อผ้าตัวเอง"        → high
 *   "เคยมีประสบการณ์การค้าขาย 3-4ปี"          → high
 *   "ประสบการณ์งานขายโดยตรงยังไม่มี"          → none
 *   "ขายผ่า เครื่องสำอาง อาหารเสริม"          → none (no duration mentioned)
 */

export type Tier = "high" | "mid" | "low" | "none";

export const TIER_CONFIG: Record<Tier, { label: string; color: string; order: number }> = {
  high: { label: "ประสบการณ์สูง",      color: "bg-emerald-100 text-emerald-700 border-emerald-300", order: 0 },
  mid:  { label: "ประสบการณ์ปานกลาง", color: "bg-blue-100 text-blue-700 border-blue-300",           order: 1 },
  low:  { label: "ประสบการณ์น้อย",     color: "bg-amber-100 text-amber-700 border-amber-300",       order: 2 },
  none: { label: "ไม่มีประสบการณ์",    color: "bg-slate-100 text-slate-500 border-slate-300",       order: 3 },
};

/** Tier thresholds (years)
 *  none : 0 / not mentioned / explicit "ไม่มี"
 *  low  : < 1 year (months only, or explicit "ต่ำกว่า 1 ปี")
 *  mid  : 1 – 3 years (inclusive)
 *  high : > 3 years
 */
export function parseTier(text: string | null | undefined): Tier {
  if (!text || text.trim() === "") return "none";

  const t = text.trim();

  // ── Explicit "no experience" keywords ────────────────────────────────────
  if (/ยังไม่|ไม่มี|ไม่เคย|ไม่ได้มี/.test(t)) return "none";
  if (/^0\s*ปี/.test(t)) return "none";

  // ── Explicit "< 1 year" phrases ──────────────────────────────────────────
  if (/ต่ำกว่า\s*1\s*ปี|น้อยกว่า\s*1\s*ปี|ไม่ถึง\s*1\s*ปี|less than 1/.test(t)) return "low";

  // ── Months only (no year number) → < 1 year → low ────────────────────────
  const hasMonth = /\d+\s*เดือน/.test(t);
  const hasYear = /\d+\s*ปี/.test(t);
  if (hasMonth && !hasYear) return "low";

  // ── Year range e.g. "3-4ปี", "1–2 ปี" ───────────────────────────────────
  const rangeMatch = t.match(/(\d+)\s*[-–]\s*(\d+)\s*ปี/);
  if (rangeMatch) {
    const max = parseFloat(rangeMatch[2]);
    if (max > 3) return "high";
    if (max >= 1) return "mid";
    return "low";
  }

  // ── Single year value e.g. "5ปี", "2 ปี", "3" ────────────────────────────
  const yearMatch = t.match(/(\d+(?:\.\d+)?)\s*ปี/);
  if (yearMatch) {
    const yrs = parseFloat(yearMatch[1]);
    if (yrs === 0) return "none";
    if (yrs < 1)  return "low";
    if (yrs <= 3) return "mid";
    return "high";
  }

  // ── Bare number at start of string e.g. "3" or "5" ───────────────────────
  const bareMatch = t.match(/^(\d+(?:\.\d+)?)\s*(?:$|[^%])/);
  if (bareMatch) {
    const yrs = parseFloat(bareMatch[1]);
    if (yrs === 0) return "none";
    if (yrs < 1)  return "low";
    if (yrs <= 3) return "mid";
    return "high";
  }

  // ── Has "ปี" text but no number (e.g. "หลายปี") ──────────────────────────
  if (/หลายปี/.test(t)) return "high";

  // ── No duration detected → treat as unknown/none ─────────────────────────
  return "none";
}
