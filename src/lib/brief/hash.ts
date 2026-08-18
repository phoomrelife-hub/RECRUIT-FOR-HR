import { createHash } from "node:crypto";
import type { ParsedBrief } from "./types";

/**
 * Cache key for a brief's scoring-relevant content.
 *
 * Deliberately covers ONLY what changes a score: the filters and the criteria.
 * Renaming the brief, toggling notifyStars, or editing rawBrief without
 * changing what it parsed to must NOT invalidate 5,959 cached scores.
 *
 * Keys are sorted so that an object built in a different field order hashes the
 * same — otherwise every save would look like a change.
 */
export function briefHash(parsed: ParsedBrief, minProximity?: string | null): string {
  const filters = Object.entries(parsed.filters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v ?? ""}`)
    .join("|");
  const criteria = parsed.criteria
    .map((c) => `${c.name}~${c.weight}~${c.description}`)
    .sort()
    .join("|");
  // minProximity is part of the key because it CHANGES WHO PASSES. Leaving it
  // out would let HR tighten the distance rule and see no effect at all, since
  // every score would still look fresh.
  return createHash("sha256")
    .update(`${filters}#${criteria}#${minProximity ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}
