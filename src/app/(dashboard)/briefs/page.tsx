import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Target } from "lucide-react";
import { BriefsClient } from "./briefs-client";
import { briefCriteria } from "@/lib/brief/run";

export default async function BriefsPage() {
  await auth();

  const positions = await db.jobPosition.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      workType: true,
      hiringBrief: true,
    },
  });

  const briefIds = positions.map((p) => p.hiringBrief?.id).filter((v): v is string => !!v);
  const grouped = briefIds.length
    ? await db.candidateBriefScore.groupBy({
        by: ["briefId"],
        where: { briefId: { in: briefIds }, filteredOut: false, stars: { gte: 4 } },
        _count: { _all: true },
      })
    : [];
  const strongByBrief = new Map(grouped.map((g) => [g.briefId, g._count._all]));

  const rows = positions.map((p) => ({
    id: p.id,
    title: p.title,
    workType: p.workType,
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
          notifyStars: p.hiringBrief.notifyStars,
          minProximity: p.hiringBrief.minProximity,
          criteria: briefCriteria(p.hiringBrief),
          strongMatches: strongByBrief.get(p.hiringBrief.id) ?? 0,
        }
      : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-blue-50 p-2">
          <Target className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">บรีฟหาคน</h1>
          <p className="text-sm text-slate-500">
            เขียนสิ่งที่อยากได้เป็นภาษาคนหนึ่งครั้ง แล้ว AI จะคัดผู้สมัครที่เข้าเกณฑ์ให้อัตโนมัติ
          </p>
        </div>
      </div>

      <BriefsClient positions={rows} />
    </div>
  );
}
