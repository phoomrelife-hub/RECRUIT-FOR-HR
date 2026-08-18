import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MatchesClient, type MatchRow } from "./matches-client";

export default async function BriefMatchesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await auth();
  const { id } = await params;

  const brief = await db.hiringBrief.findUnique({
    where: { id },
    include: { jobPosition: { select: { title: true } } },
  });
  if (!brief) notFound();

  const rows = await db.candidateBriefScore.findMany({
    where: { briefId: id },
    orderBy: [{ stars: "desc" }, { overallScore: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      stars: true,
      overallScore: true,
      coveragePct: true,
      why: true,
      filteredOut: true,
      filterReason: true,
      candidate: {
        select: {
          id: true,
          fullName: true,
          nickname: true,
          lineDisplayName: true,
          phone: true,
          age: true,
          expectedSalary: true,
          workPreference: true,
          experienceText: true,
          currentStatus: true,
        },
      },
    },
  });

  const matches: MatchRow[] = rows.map((r) => ({
    id: r.id,
    stars: r.stars,
    overallScore: r.overallScore,
    coveragePct: r.coveragePct,
    why: r.why,
    filteredOut: r.filteredOut,
    filterReason: r.filterReason,
    candidate: {
      id: r.candidate.id,
      name:
        r.candidate.fullName ||
        r.candidate.nickname ||
        r.candidate.lineDisplayName ||
        "ไม่ระบุชื่อ",
      phone: r.candidate.phone,
      age: r.candidate.age,
      expectedSalary: r.candidate.expectedSalary,
      workPreference: r.candidate.workPreference,
      experienceText: r.candidate.experienceText,
      currentStatus: r.candidate.currentStatus,
    },
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/briefs"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปหน้าบรีฟ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          ผลคัด — {brief.jobPosition.title}
        </h1>
        <p className="text-sm text-slate-500">
          เรียงจากดาวมากไปน้อย · ดาวคิดจากคะแนนและปริมาณข้อมูลที่มี
        </p>
      </div>

      <MatchesClient matches={matches} />
    </div>
  );
}
