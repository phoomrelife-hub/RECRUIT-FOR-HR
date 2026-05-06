import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { StatCard } from "@/components/dashboard/stat-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  TrendingUp,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { CandidateStatus, SourceChannel } from "@prisma/client";

async function getDashboardData() {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const sixMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const MONTH_NAMES = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];

  const [
    totalCandidates,
    thisMonthCandidates,
    lastMonthCandidates,
    waitingHR,
    qualified,
    passed,
    rejected,
    talentPool,
    interviewScheduled,
    lineCount,
    fbCount,
    recentCandidates,
    recentForTrend,
  ] = await Promise.all([
    db.candidate.count(),
    db.candidate.count({ where: { createdAt: { gte: startOfThisMonth } } }),
    db.candidate.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
    db.candidate.count({ where: { currentStatus: CandidateStatus.WAITING_HR_REVIEW } }),
    db.candidate.count({ where: { currentStatus: CandidateStatus.QUALIFIED } }),
    db.candidate.count({ where: { currentStatus: CandidateStatus.PASSED } }),
    db.candidate.count({ where: { currentStatus: CandidateStatus.REJECTED } }),
    db.candidate.count({ where: { currentStatus: CandidateStatus.TALENT_POOL } }),
    db.candidate.count({ where: { currentStatus: CandidateStatus.INTERVIEW_SCHEDULED } }),
    db.candidate.count({ where: { sourceChannel: SourceChannel.LINE } }),
    db.candidate.count({ where: { sourceChannel: SourceChannel.FACEBOOK } }),
    db.candidate.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { interestedPosition: { select: { title: true } } },
    }),
    db.candidate.findMany({
      where: { createdAt: { gte: sixMonthsAgoStart } },
      select: { createdAt: true },
    }),
  ]);

  // Build monthly trend (last 6 months)
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

  const monthChange =
    lastMonthCandidates > 0
      ? Math.round(((thisMonthCandidates - lastMonthCandidates) / lastMonthCandidates) * 100)
      : 0;

  return {
    totalCandidates,
    thisMonthCandidates,
    lastMonthCandidates,
    monthChange,
    waitingHR,
    qualified,
    passed,
    rejected,
    talentPool,
    interviewScheduled,
    lineCount,
    fbCount,
    recentCandidates,
    monthlyTrend,
  };
}

const statusColors: Record<CandidateStatus, string> = {
  NEW_APPLICANT: "bg-slate-100 text-slate-700",
  BOT_SCREENING: "bg-purple-100 text-purple-700",
  WAITING_HR_REVIEW: "bg-yellow-100 text-yellow-700",
  NEED_MORE_INFO: "bg-orange-100 text-orange-700",
  QUALIFIED: "bg-blue-100 text-blue-700",
  INTERVIEW_SCHEDULED: "bg-indigo-100 text-indigo-700",
  INTERVIEWED: "bg-cyan-100 text-cyan-700",
  PASSED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  TALENT_POOL: "bg-teal-100 text-teal-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

const statusLabels: Record<CandidateStatus, string> = {
  NEW_APPLICANT: "ผู้สมัครใหม่",
  BOT_SCREENING: "บอทคัดกรอง",
  WAITING_HR_REVIEW: "รอ HR พิจารณา",
  NEED_MORE_INFO: "ขอข้อมูลเพิ่ม",
  QUALIFIED: "ผ่านเกณฑ์",
  INTERVIEW_SCHEDULED: "นัดสัมภาษณ์",
  INTERVIEWED: "สัมภาษณ์แล้ว",
  PASSED: "ผ่านการคัดเลือก",
  REJECTED: "ไม่ผ่าน",
  TALENT_POOL: "Talent Pool",
  CLOSED: "ปิด",
};

export default async function DashboardPage() {
  const session = await auth();
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          สวัสดี, {session?.user?.name} — ภาพรวมการรับสมัครงาน
        </p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="ผู้สมัครทั้งหมด"
          value={data.totalCandidates}
          subtitle="ตลอดเวลา"
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="เดือนนี้"
          value={data.thisMonthCandidates}
          subtitle={`เดือนที่แล้ว: ${data.lastMonthCandidates}`}
          icon={TrendingUp}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          trend={
            data.lastMonthCandidates > 0
              ? { value: data.monthChange, label: "เทียบเดือนที่แล้ว" }
              : undefined
          }
        />
        <StatCard
          title="รอ HR พิจารณา"
          value={data.waitingHR}
          subtitle="รอตรวจสอบ"
          icon={Clock}
          iconColor="text-yellow-600"
          iconBg="bg-yellow-50"
        />
        <StatCard
          title="นัดสัมภาษณ์"
          value={data.interviewScheduled}
          subtitle="รอสัมภาษณ์"
          icon={Calendar}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="ผ่านเกณฑ์"
          value={data.qualified}
          icon={CheckCircle2}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="ผ่านการคัดเลือก"
          value={data.passed}
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          title="ไม่ผ่าน"
          value={data.rejected}
          icon={XCircle}
          iconColor="text-red-500"
          iconBg="bg-red-50"
        />
        <StatCard
          title="Talent Pool"
          value={data.talentPool}
          icon={Users}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
        />
      </div>

      {/* Monthly Trend */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-base font-semibold">ผู้สมัครรายเดือน (6 เดือนล่าสุด)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <TrendChart data={data.monthlyTrend} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-6">
        {/* Source Channel */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">ช่องทางรับสมัคร</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-slate-700">LINE OA</span>
              </div>
              <span className="text-lg font-bold text-slate-900">{data.lineCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-slate-700">Facebook</span>
              </div>
              <span className="text-lg font-bold text-slate-900">{data.fbCount}</span>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">แจ้งเตือน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.waitingHR > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3">
                <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">{data.waitingHR}</span> คนรอ HR ตรวจ
                </p>
              </div>
            )}
            {data.interviewScheduled > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-purple-50 p-3">
                <Calendar className="h-4 w-4 text-purple-600 shrink-0" />
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">{data.interviewScheduled}</span> นัดสัมภาษณ์
                </p>
              </div>
            )}
            {data.waitingHR === 0 && data.interviewScheduled === 0 && (
              <p className="text-sm text-slate-400 py-2">ไม่มีแจ้งเตือน</p>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Overview */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">ภาพรวม Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.totalCandidates === 0 ? (
              <p className="text-sm text-slate-400 py-2">ยังไม่มีผู้สมัคร</p>
            ) : (
              <>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>ผ่านเกณฑ์</span>
                  <span>{data.qualified} / {data.totalCandidates}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${(data.qualified / data.totalCandidates) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>ผ่านการคัดเลือก</span>
                  <span>{data.passed} / {data.totalCandidates}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: `${(data.passed / data.totalCandidates) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>ไม่ผ่าน</span>
                  <span>{data.rejected} / {data.totalCandidates}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-red-400"
                    style={{ width: `${(data.rejected / data.totalCandidates) * 100}%` }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Candidates */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">ผู้สมัครล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentCandidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีผู้สมัคร</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentCandidates.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {(c.nickname || c.fullName || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {c.nickname || c.fullName || "ไม่ระบุชื่อ"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {c.interestedPosition?.title ?? "ไม่ระบุตำแหน่ง"} · {c.sourceChannel}
                      </p>
                    </div>
                  </div>
                  <Badge className={statusColors[c.currentStatus]}>
                    {statusLabels[c.currentStatus]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
