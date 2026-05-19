import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

/**
 * Open job positions for filter dropdowns (candidates, pipeline pages).
 * Cached 60s — positions change rarely and a 1-minute delay is acceptable.
 * Tag "open-jobs" lets you call revalidateTag("open-jobs") after any
 * job position mutation to bust the cache immediately.
 */
export const getCachedOpenJobs = unstable_cache(
  () =>
    db.jobPosition.findMany({
      where: { status: "OPEN" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ["open-jobs"],
  { revalidate: 60, tags: ["open-jobs"] }
);

/**
 * All job positions (open + closed) for fuzzy position matching on the review page.
 * Cached 60s — same rationale as above.
 */
export const getCachedAllJobs = unstable_cache(
  () =>
    db.jobPosition.findMany({
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
  ["all-jobs"],
  { revalidate: 60, tags: ["all-jobs"] }
);
