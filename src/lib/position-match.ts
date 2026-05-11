// Shared fuzzy position matching — used by form webhook, backfill endpoint, review page

export type PositionOption = { id: string; title: string };

/** Normalize: lowercase, collapse slashes/dashes/spaces */
export function normPos(s: string) {
  return s.toLowerCase().replace(/[\/\-]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Fuzzy-match a submitted position title against a list of active positions.
 * Pass 1: normalized prefix (14 chars) contains check.
 * Pass 2: significant word (≥4 chars) overlap.
 */
export function fuzzyMatchPosition(
  submittedTitle: string,
  positions: PositionOption[]
): PositionOption | undefined {
  if (!submittedTitle || positions.length === 0) return undefined;

  const normSubmitted = normPos(submittedTitle);
  const prefix = normSubmitted.substring(0, 14);

  // Pass 1 — prefix contains
  let matched = positions.find((p) => {
    const normP = normPos(p.title);
    return (
      normP.includes(prefix) ||
      normSubmitted.includes(normPos(p.title).substring(0, 14))
    );
  });

  // Pass 2 — word overlap
  if (!matched) {
    const submittedWords = new Set(
      normSubmitted.split(" ").filter((w) => w.length >= 4)
    );
    let maxOverlap = 0;
    for (const p of positions) {
      const pWords = normPos(p.title).split(" ").filter((w) => w.length >= 4);
      const overlap = pWords.filter((w) => submittedWords.has(w)).length;
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        matched = p;
      }
    }
    if (maxOverlap === 0) matched = undefined;
  }

  return matched;
}

/** Extract "ตำแหน่ง: XXX" from a SYSTEM message string */
export function extractPositionFromMessage(content: string): string | null {
  const m = content.match(/ตำแหน่ง:\s*(.+)/);
  return m?.[1]?.trim() ?? null;
}
