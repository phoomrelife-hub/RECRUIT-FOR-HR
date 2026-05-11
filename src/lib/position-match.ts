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

/**
 * Search for a known position title INSIDE free-text (candidate messages).
 * Tries: exact normalized contains → prefix-10-char → word overlap ≥60%.
 */
export function findPositionInText(
  content: string,
  positions: PositionOption[]
): PositionOption | undefined {
  if (!content || positions.length === 0) return undefined;

  const normContent = normPos(content);

  // Pass 1 — position title contained in message
  for (const p of positions) {
    const normTitle = normPos(p.title);
    if (normContent.includes(normTitle)) return p;
    // prefix check (≥8 chars to avoid false positives)
    const prefix = normTitle.substring(0, 10);
    if (prefix.length >= 8 && normContent.includes(prefix)) return p;
  }

  // Pass 2 — word overlap (≥60% of position words found in message)
  let bestMatch: PositionOption | undefined;
  let maxOverlap = 0;
  for (const p of positions) {
    const pWords = normPos(p.title).split(" ").filter((w) => w.length >= 4);
    if (pWords.length === 0) continue;
    const contentWords = new Set(normContent.split(" ").filter((w) => w.length >= 4));
    const overlap = pWords.filter((w) => contentWords.has(w)).length;
    const ratio = overlap / pWords.length;
    if (ratio >= 0.6 && overlap > maxOverlap) {
      maxOverlap = overlap;
      bestMatch = p;
    }
  }

  return bestMatch;
}
