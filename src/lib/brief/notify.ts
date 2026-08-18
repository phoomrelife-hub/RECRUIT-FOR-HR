import { db } from "@/lib/db";
import { buildDigestCard, buildInstantCard, sendLark, type MatchCardCandidate } from "@/lib/lark";

/**
 * Telling HR about a match.
 *
 * Two speeds, because one speed is always wrong: a 5-star candidate is worth
 * interrupting someone for, and 54 candidates a day at that volume is not. The
 * threshold lives on the brief (`notifyStars`) so HR can tune it per position.
 *
 * `notifiedAt` is the idempotency guard. It is set only after Lark accepts the
 * message, so a failed send is retried on the next tick rather than silently
 * swallowed — and it is cleared on re-score, so a candidate who improves after
 * a brief edit can be surfaced again.
 */

function appBase(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function displayName(c: {
  fullName: string | null;
  nickname: string | null;
  lineDisplayName: string | null;
}): string {
  return c.fullName || c.nickname || c.lineDisplayName || "ไม่ระบุชื่อ";
}

interface PendingRow {
  id: string;
  stars: number;
  why: string;
  proximityTier: string | null;
  candidate: {
    id: string;
    fullName: string | null;
    nickname: string | null;
    lineDisplayName: string | null;
    resumeUrl: string | null;
    portfolioUrl: string | null;
  };
}

const PROXIMITY_LABEL: Record<string, string> = {
  adjacent: "ใกล้ออฟฟิศมาก",
  nearby: "เดินทางสะดวก",
  bangkok: "ในกรุงเทพ",
  commutable_province: "ปริมณฑล",
  far: "ต่างจังหวัด",
  unknown: "ไม่ระบุที่อยู่",
};

function toCard(row: PendingRow): MatchCardCandidate {
  return {
    name: displayName(row.candidate),
    stars: row.stars,
    why: row.why,
    url: `${appBase()}/candidates/${row.candidate.id}`,
    proximity: row.proximityTier ? (PROXIMITY_LABEL[row.proximityTier] ?? null) : null,
    resumeUrl: row.candidate.resumeUrl,
    portfolioUrl: row.candidate.portfolioUrl,
  };
}

export interface NotifySummary {
  instantSent: number;
  digestSent: number;
  digestCandidates: number;
  errors: string[];
}

/**
 * Send everything outstanding for every active brief.
 *
 * `instantOnly` is what the post-scoring hook calls: it pushes the 5-star finds
 * immediately and leaves the rest for the daily tick, so a candidate arriving
 * at 14:00 does not generate a one-person digest.
 */
export async function notifyPending(instantOnly = false): Promise<NotifySummary> {
  const summary: NotifySummary = {
    instantSent: 0,
    digestSent: 0,
    digestCandidates: 0,
    errors: [],
  };

  const briefs = await db.hiringBrief.findMany({
    where: { isActive: true },
    include: { jobPosition: { select: { title: true } } },
  });

  for (const brief of briefs) {
    const pending = await db.candidateBriefScore.findMany({
      where: {
        briefId: brief.id,
        notifiedAt: null,
        filteredOut: false,
        // Nothing below 3 stars is worth a message at all; it stays in the UI
        // for anyone who wants to browse down.
        stars: { gte: 3 },
      },
      orderBy: [{ stars: "desc" }, { overallScore: "desc" }],
      select: {
        id: true,
        stars: true,
        why: true,
        proximityTier: true,
        candidate: {
          select: {
            id: true,
            fullName: true,
            nickname: true,
            lineDisplayName: true,
            resumeUrl: true,
            portfolioUrl: true,
          },
        },
      },
    });
    if (pending.length === 0) continue;

    const instant = pending.filter((p) => p.stars >= brief.notifyStars);
    const rest = pending.filter((p) => p.stars < brief.notifyStars);

    for (const row of instant) {
      const res = await sendLark(buildInstantCard(brief.jobPosition.title, toCard(row)));
      if (res.ok) {
        await db.candidateBriefScore.update({
          where: { id: row.id },
          data: { notifiedAt: new Date() },
        });
        summary.instantSent++;
      } else {
        summary.errors.push(`instant ${row.id}: ${res.error}`);
      }
    }

    if (instantOnly || rest.length === 0) continue;

    const res = await sendLark(
      buildDigestCard(
        brief.jobPosition.title,
        rest.map(toCard),
        `${appBase()}/briefs/${brief.id}`,
      ),
    );
    if (res.ok) {
      // Marked as a set: the digest either went out for all of them or none, so
      // a partial update would strand candidates in a state nothing retries.
      await db.candidateBriefScore.updateMany({
        where: { id: { in: rest.map((r) => r.id) } },
        data: { notifiedAt: new Date() },
      });
      summary.digestSent++;
      summary.digestCandidates += rest.length;
    } else {
      summary.errors.push(`digest ${brief.id}: ${res.error}`);
    }
  }

  return summary;
}
