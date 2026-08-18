import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { BriefsWorkbench, type PositionRow } from "./briefs-workbench";
import { briefCriteria } from "@/lib/brief/run";

/**
 * The brief editor, as a master-detail workbench.
 *
 * Sorted by waiting count rather than name, because the workload is extremely
 * lopsided: Sales Admin holds 757 of the ~860 candidates awaiting review, and an
 * alphabetical list would bury the only position that matters most days.
 */
export default async function BriefsPage() {
  await auth();

  const [positions, waitingCounts, strongCounts] = await Promise.all([
    db.jobPosition.findMany({
      where: { status: "OPEN" },
      select: { id: true, title: true, workType: true, headcount: true, hiringBrief: true },
    }),
    db.candidate.groupBy({
      by: ["interestedPositionId"],
      where: { currentStatus: "WAITING_HR_REVIEW", interestedPositionId: { not: null } },
      _count: { _all: true },
    }),
    db.candidateBriefScore.groupBy({
      by: ["briefId"],
      where: { filteredOut: false, stars: { gte: 4 } },
      _count: { _all: true },
    }),
  ]);

  const waitingBy = new Map(waitingCounts.map((w) => [w.interestedPositionId, w._count._all]));
  const strongBy = new Map(strongCounts.map((s) => [s.briefId, s._count._all]));

  const rows: PositionRow[] = positions
    .map((p) => ({
      id: p.id,
      title: p.title,
      workType: p.workType,
      headcount: p.headcount,
      waiting: waitingBy.get(p.id) ?? 0,
      brief: p.hiringBrief
        ? {
            id: p.hiringBrief.id,
            rawBrief: p.hiringBrief.rawBrief,
            minAge: p.hiringBrief.minAge,
            maxAge: p.hiringBrief.maxAge,
            minSalary: p.hiringBrief.minSalary,
            maxSalary: p.hiringBrief.maxSalary,
            workPreference: p.hiringBrief.workPreference,
            minExperienceYears: p.hiringBrief.minExperienceYears,
            minSalesAmount: p.hiringBrief.minSalesAmount,
            minProximity: p.hiringBrief.minProximity,
            requiredEquipment: p.hiringBrief.requiredEquipment,
            notifyStars: p.hiringBrief.notifyStars,
            notifyFullSpecStars: p.hiringBrief.notifyFullSpecStars,
            criteria: briefCriteria(p.hiringBrief),
            strongMatches: strongBy.get(p.hiringBrief.id) ?? 0,
          }
        : null,
    }))
    .sort((a, b) => b.waiting - a.waiting || a.title.localeCompare(b.title, "th"));

  return <BriefsWorkbench positions={rows} />;
}
