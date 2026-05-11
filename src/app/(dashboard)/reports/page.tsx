import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CandidateStatus, SourceChannel, InterviewStatus, HiringResult } from "@prisma/client";
import { ReportsClient } from "./reports-client";
import type { ReportsData } from "./reports-client";

const STAGE_ORDER: CandidateStatus[] = [
  "NEW_APPLICANT",
  "BOT_SCREENING",
  "WAITING_HR_REVIEW",
  "NEED_MORE_INFO",
  "QUALIFIED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEWED",
  "PASSED",
  "TALENT_POOL",
  "REJECTED",
  "CLOSED",
];

const STAGE_LABELS: Record<CandidateStatus, string> = {
  NEW_APPLICANT: "New Applicant",
  BOT_SCREENING: "Bot Screening",
  WAITING_HR_REVIEW: "Waiting HR Review",
  NEED_MORE_INFO: "Need More Info",
  QUALIFIED: "Qualified",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEWED: "Interviewed",
  PASSED: "Passed",
  TALENT_POOL: "Talent Pool",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

const STAGE_COLORS: Record<CandidateStatus, string> = {
  NEW_APPLICANT: "#94a3b8",
  BOT_SCREENING: "#a78bfa",
  WAITING_HR_REVIEW: "#fbbf24",
  NEED_MORE_INFO: "#fb923c",
  QUALIFIED: "#60a5fa",
  INTERVIEW_SCHEDULED: "#818cf8",
  INTERVIEWED: "#22d3ee",
  PASSED: "#34d399",
  TALENT_POOL: "#2dd4bf",
  REJECTED: "#f87171",
  CLOSED: "#cbd5e1",
};

const SOURCE_LABELS: Record<SourceChannel, string> = {
  LINE: "LINE OA",
  FACEBOOK: "Facebook",
  WEBSITE: "Website",
  MANUAL: "Manual",
  JOBBKK: "JobBKK",
  JOBTHAI: "JobThai",
  OTHER: "Other",
};

const SOURCE_COLORS: Record<SourceChannel, string> = {
  LINE: "#22c55e",
  FACEBOOK: "#3b82f6",
  WEBSITE: "#a855f7",
  MANUAL: "#64748b",
  JOBBKK: "#ef4444",
  JOBTHAI: "#f97316",
  OTHER: "#94a3b8",
};

const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  NO_SHOW: "No Show",
  CANCELLED: "Cancelled",
};

const INTERVIEW_STATUS_COLORS: Record<InterviewStatus, string> = {
  SCHEDULED: "#818cf8",
  COMPLETED: "#34d399",
  NO_SHOW: "#f87171",
  CANCELLED: "#94a3b8",
};

const HIRING_LABELS: Record<HiringResult, string> = {
  PASSED: "Passed",
  HIRED: "Hired",
  REJECTED: "Rejected",
  TALENT_POOL: "Talent Pool",
  CLOSED: "Closed",
};

const HIRING_COLORS: Record<HiringResult, string> = {
  PASSED: "#34d399",
  HIRED: "#10b981",
  REJECTED: "#f87171",
  TALENT_POOL: "#2dd4bf",
  CLOSED: "#94a3b8",
};

const MONTH_NAMES = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

async function getReportsData(): Promise<ReportsData> {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const sixMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    totalCandidates,
    thisMonthCandidates,
    lastMonthCandidates,
    candidatesByStatus,
    candidatesBySource,
    positions,
    recentForTrend,
    interviewsByStatus,
    hiringOutcomes,
    totalInterviews,
    totalPassed,
  ] = await Promise.all([
    db.candidate.count(),
    db.candidate.count({ where: { createdAt: { gte: startOfThisMonth } } }),
    db.candidate.count({
      where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
    }),
    db.candidate.groupBy({ by: ["currentStatus"], _count: { id: true } }),
    db.candidate.groupBy({ by: ["sourceChannel"], _count: { id: true } }),
    db.jobPosition.findMany({
      include: { candidates: { select: { currentStatus: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.candidate.findMany({
      where: { createdAt: { gte: sixMonthsAgoStart } },
      select: { createdAt: true },
    }),
    db.interview.groupBy({ by: ["status"], _count: { id: true } }),
    db.hiringDecision.groupBy({ by: ["result"], _count: { id: true } }),
    db.interview.count(),
    db.candidate.count({ where: { currentStatus: "PASSED" } }),
  ]);

  // Funnel data
  const statusCountMap = new Map(
    candidatesByStatus.map((s) => [s.currentStatus, s._count.id])
  );
  const funnelData = STAGE_ORDER.map((status) => ({
    status,
    label: STAGE_LABELS[status],
    count: statusCountMap.get(status) ?? 0,
    color: STAGE_COLORS[status],
  }));

  // Source data
  const sourceData = (["LINE", "FACEBOOK", "WEBSITE", "MANUAL", "JOBBKK", "JOBTHAI", "OTHER"] as SourceChannel[]).map((s) => ({
    source: s,
    label: SOURCE_LABELS[s],
    count: candidatesBySource.find((x) => x.sourceChannel === s)?._count.id ?? 0,
    color: SOURCE_COLORS[s],
  }));

  // Monthly trend
  const monthlyMap = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, 0);
  }
  for (const c of recentForTrend) {
    const key = `${c.createdAt.getFullYear()}-${String(c.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap.has(key)) {
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
    }
  }
  const monthlyTrend = Array.from(monthlyMap.entries()).map(([key, count]) => {
    const monthNum = parseInt(key.split("-")[1]) - 1;
    return { month: MONTH_NAMES[monthNum], count };
  });

  // Position data
  const positionData = positions.map((p) => ({
    title: p.title,
    total: p.candidates.length,
    qualified: p.candidates.filter((c) =>
      ["QUALIFIED", "INTERVIEW_SCHEDULED", "INTERVIEWED", "PASSED", "TALENT_POOL"].includes(
        c.currentStatus
      )
    ).length,
    passed: p.candidates.filter((c) => c.currentStatus === "PASSED").length,
  }));

  // Interview status data
  const interviewStatusMap = new Map(
    interviewsByStatus.map((i) => [i.status, i._count.id])
  );
  const interviewStatusData = (
    ["SCHEDULED", "COMPLETED", "NO_SHOW", "CANCELLED"] as InterviewStatus[]
  ).map((s) => ({
    status: s,
    label: INTERVIEW_STATUS_LABELS[s],
    count: interviewStatusMap.get(s) ?? 0,
    color: INTERVIEW_STATUS_COLORS[s],
  }));

  // Hiring outcome data
  const hiringMap = new Map(hiringOutcomes.map((h) => [h.result, h._count.id]));
  const hiringOutcomeData = (
    ["PASSED", "HIRED", "TALENT_POOL", "REJECTED", "CLOSED"] as HiringResult[]
  ).map((r) => ({
    result: r,
    label: HIRING_LABELS[r],
    count: hiringMap.get(r) ?? 0,
    color: HIRING_COLORS[r],
  }));

  // Rates
  const passRate =
    totalCandidates > 0
      ? Math.round((totalPassed / totalCandidates) * 1000) / 10
      : 0;
  const completedInterviews = interviewStatusMap.get("COMPLETED") ?? 0;
  const interviewCompleteRate =
    totalInterviews > 0
      ? Math.round((completedInterviews / totalInterviews) * 1000) / 10
      : 0;

  return {
    summary: {
      totalCandidates,
      thisMonthCount: thisMonthCandidates,
      lastMonthCount: lastMonthCandidates,
      passRate,
      interviewCompleteRate,
    },
    funnelData,
    sourceData,
    monthlyTrend,
    positionData,
    interviewStatusData,
    hiringOutcomeData,
  };
}

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.role || session.user.role === "HR_STAFF") {
    redirect("/dashboard");
  }

  const data = await getReportsData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">ภาพรวมและสถิติการรับสมัครงาน</p>
      </div>
      <ReportsClient data={data} />
    </div>
  );
}
