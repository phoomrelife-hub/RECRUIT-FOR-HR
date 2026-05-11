import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TrendChartInteractive } from "@/components/dashboard/trend-chart-interactive";
import {
  Users,
  MessageSquare,
  Clock,
  CalendarDays,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Video,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { CandidateStatus, SourceChannel } from "@prisma/client";
import Link from "next/link";

// ── Thai helpers ──────────────────────────────────────────────────────────────
const MONTH_FULL  = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const DOW_THAI   = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];

const statusColors: Partial<Record<CandidateStatus, string>> = {
  NEW_APPLICANT:       "bg-slate-100 text-slate-600",
  BOT_SCREENING:       "bg-purple-100 text-purple-700",
  WAITING_HR_REVIEW:   "bg-amber-100 text-amber-700",
  NEED_MORE_INFO:      "bg-orange-100 text-orange-700",
  QUALIFIED:           "bg-blue-100 text-blue-700",
  INTERVIEW_SCHEDULED: "bg-indigo-100 text-indigo-700",
  INTERVIEWED:         "bg-cyan-100 text-cyan-700",
  PASSED:              "bg-emerald-100 text-emerald-700",
  REJECTED:            "bg-red-100 text-red-600",
  TALENT_POOL:         "bg-teal-100 text-teal-700",
  CLOSED:              "bg-slate-100 text-slate-400",
};
const statusLabels: Partial<Record<CandidateStatus, string>> = {
  NEW_APPLICANT:       "ผู้สมัครใหม่",
  BOT_SCREENING:       "บอทคัดกรอง",
  WAITING_HR_REVIEW:   "รอ HR พิจารณา",
  NEED_MORE_INFO:      "ขอข้อมูลเพิ่ม",
  QUALIFIED:           "ผ่านเกณฑ์",
  INTERVIEW_SCHEDULED: "นัดสัมภาษณ์",
  INTERVIEWED:         "สัมภาษณ์แล้ว",
  PASSED:              "ผ่านการคัดเลือก",
  REJECTED:            "ไม่ผ่าน",
  TALENT_POOL:         "Talent Pool",
  CLOSED:              "ปิด",
};

async function getData() {
  const now = new Date();
  const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLastMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endLastMonth    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Bangkok today range
  const bkkNow   = new Date(now.getTime() + 7 * 3600000);
  const y = bkkNow.getUTCFullYear(), m = bkkNow.getUTCMonth(), d = bkkNow.getUTCDate();
  const todayStart = new Date(Date.UTC(y, m, d) - 7 * 3600000);
  const todayEnd   = new Date(Date.UTC(y, m, d + 1) - 7 * 3600000);

  const [
    totalCandidates,
    thisMonth,
    lastMonth,
    waitingHR,
    qualified,
    passed,
    rejected,
    interviewScheduled,
    lineCount,
    recentCandidates,
    todayInterviews,
  ] = await Promise.all([
    db.candidate.count(),
    db.candidate.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.candidate.count({ where: { createdAt: { gte: startLastMonth, lte: endLastMonth } } }),
    db.candidate.count({ where: { currentStatus: { in: ["WAITING_HR_REVIEW","BOT_SCREENING","NEW_APPLICANT","NEED_MORE_INFO"] } } }),
    db.candidate.count({ where: { currentStatus: "QUALIFIED" } }),
    db.candidate.count({ where: { currentStatus: "PASSED" } }),
    db.candidate.count({ where: { currentStatus: "REJECTED" } }),
    db.candidate.count({ where: { currentStatus: "INTERVIEW_SCHEDULED" } }),
    db.candidate.count({ where: { sourceChannel: SourceChannel.LINE } }),
    db.candidate.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, nickname: true, fullName: true, lineDisplayName: true,
        lineProfilePicUrl: true, currentStatus: true, createdAt: true,
        interestedPosition: { select: { title: true } },
      },
    }),
    db.interview.findMany({
      where: { status: "SCHEDULED", interviewDate: { gte: todayStart, lt: todayEnd } },
      select: {
        id: true, startTime: true, interviewType: true, location: true,
        meetingLink: true, candidateResponse: true,
        candidate: {
          select: {
            id: true, fullName: true, nickname: true, lineDisplayName: true,
            lineProfilePicUrl: true, interestedPosition: { select: { title: true } },
          },
        },
      },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const monthChange = lastMonth > 0
    ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
    : 0;

  return {
    totalCandidates, thisMonth, lastMonth, monthChange,
    waitingHR, qualified, passed, rejected, interviewScheduled,
    lineCount, recentCandidates, todayInterviews,
    todayLabel: `วัน${DOW_THAI[now.getDay()]}ที่ ${now.getDate()} ${MONTH_FULL[now.getMonth()]} ${now.getFullYear() + 543}`,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const data = await getData();

  const firstName = session?.user?.name?.split(" ")[0] ?? session?.user?.name ?? "";

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-slate-400">{data.todayLabel}</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
            สวัสดี{firstName ? `, ${firstName}` : ""} 👋
          </h1>
        </div>
        <Link href="/review" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
          ดูคิวพิจารณา <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── Hero Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* This month */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white shadow-md">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
          <div className="absolute -right-1 bottom-2 h-16 w-16 rounded-full bg-white/5" />
          <p className="text-sm font-medium text-blue-100">ผู้สมัครเดือนนี้</p>
          <p className="mt-1 text-4xl font-bold">{data.thisMonth}</p>
          <p className={`mt-1.5 text-xs font-medium ${data.monthChange >= 0 ? "text-blue-200" : "text-red-300"}`}>
            {data.monthChange >= 0 ? "↑" : "↓"} {Math.abs(data.monthChange)}% จากเดือนที่แล้ว ({data.lastMonth} คน)
          </p>
          <div className="absolute right-4 top-4 rounded-xl bg-white/15 p-2.5">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
        </div>

        {/* Waiting HR */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white shadow-md">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
          <div className="absolute -right-1 bottom-2 h-16 w-16 rounded-full bg-white/5" />
          <p className="text-sm font-medium text-amber-100">คิวรอพิจารณา</p>
          <p className="mt-1 text-4xl font-bold">{data.waitingHR}</p>
          <p className="mt-1.5 text-xs text-amber-100">
            {data.waitingHR === 0 ? "ไม่มีรายการค้าง ✅" : "รอ HR ตรวจสอบ"}
          </p>
          <div className="absolute right-4 top-4 rounded-xl bg-white/15 p-2.5">
            <Clock className="h-5 w-5 text-white" />
          </div>
        </div>

        {/* Today interviews */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-md">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
          <div className="absolute -right-1 bottom-2 h-16 w-16 rounded-full bg-white/5" />
          <p className="text-sm font-medium text-emerald-100">นัดวันนี้</p>
          <p className="mt-1 text-4xl font-bold">{data.todayInterviews.length}</p>
          <p className="mt-1.5 text-xs text-emerald-100">
            {data.todayInterviews.length === 0 ? "ไม่มีนัดวันนี้" : `${data.interviewScheduled} นัดรวมทั้งหมด`}
          </p>
          <div className="absolute right-4 top-4 rounded-xl bg-white/15 p-2.5">
            <CalendarDays className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>

      {/* ── Middle row: Chart + Funnel ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Trend chart — interactive (day / week / month) */}
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <TrendChartInteractive defaultPeriod="monthly" />
        </div>

        {/* Funnel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Conversion Funnel</h3>
          <div className="space-y-3">
            {[
              { label: "ผู้สมัครทั้งหมด", value: data.totalCandidates, color: "bg-slate-400", pct: 100 },
              { label: "ผ่านเกณฑ์", value: data.qualified, color: "bg-blue-500",
                pct: data.totalCandidates ? Math.round((data.qualified / data.totalCandidates) * 100) : 0 },
              { label: "นัดสัมภาษณ์", value: data.interviewScheduled, color: "bg-violet-500",
                pct: data.totalCandidates ? Math.round((data.interviewScheduled / data.totalCandidates) * 100) : 0 },
              { label: "ผ่านการคัดเลือก", value: data.passed, color: "bg-emerald-500",
                pct: data.totalCandidates ? Math.round((data.passed / data.totalCandidates) * 100) : 0 },
              { label: "ไม่ผ่าน", value: data.rejected, color: "bg-red-400",
                pct: data.totalCandidates ? Math.round((data.rejected / data.totalCandidates) * 100) : 0 },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-600">{row.label}</span>
                  <span className="text-xs font-semibold text-slate-800">{row.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div
                    className={`h-1.5 rounded-full ${row.color} transition-all`}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Channel mini */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">ช่องทาง</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-xl bg-green-50 border border-green-100 px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> LINE
                </span>
                <span className="text-sm font-bold text-green-800">{data.lineCount}</span>
              </div>
              <div className="flex-1 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-blue-700 font-medium flex items-center gap-1">
                  <Users className="h-3 w-3" /> อื่นๆ
                </span>
                <span className="text-sm font-bold text-blue-800">{data.totalCandidates - data.lineCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row: Today interviews + Recent candidates ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Today's interviews */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">นัดสัมภาษณ์วันนี้</h3>
            <Link href="/calendar" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
              ปฏิทินเต็ม <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {data.todayInterviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <CalendarDays className="h-8 w-8 text-slate-200 mb-2" />
              <p className="text-sm">ไม่มีนัดวันนี้</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.todayInterviews.map((iv) => {
                const c = iv.candidate;
                const name = c.fullName ?? c.nickname ?? c.lineDisplayName ?? "ไม่ระบุ";
                const isOnline = iv.interviewType === "ONLINE";
                const resp = iv.candidateResponse;
                return (
                  <Link key={iv.id} href={`/candidates/${c.id}`}>
                    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:border-slate-300 hover:bg-white transition-colors">
                      {/* Avatar */}
                      {c.lineProfilePicUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.lineProfilePicUrl} alt={name} className="h-8 w-8 rounded-full object-cover border border-green-200 shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                        <p className="text-xs text-slate-400">{iv.startTime} น. · {c.interestedPosition?.title ?? "-"}</p>
                      </div>
                      {/* Badges */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${isOnline ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"}`}>
                          {isOnline ? <Video className="h-2.5 w-2.5" /> : <MapPin className="h-2.5 w-2.5" />}
                          {isOnline ? "ออนไลน์" : "On-site"}
                        </span>
                        {resp === "confirmed" && <span className="text-emerald-500 text-xs">✅</span>}
                        {resp === "declined"  && <span className="text-red-400 text-xs">❌</span>}
                        {!resp               && <span className="text-slate-300 text-xs">⏳</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent candidates */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">ผู้สมัครล่าสุด</h3>
            <Link href="/candidates" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
              ดูทั้งหมด <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {data.recentCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Users className="h-8 w-8 text-slate-200 mb-2" />
              <p className="text-sm">ยังไม่มีผู้สมัคร</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.recentCandidates.map((c) => {
                const name = c.fullName ?? c.nickname ?? c.lineDisplayName ?? "ไม่ระบุ";
                return (
                  <Link key={c.id} href={`/candidates/${c.id}`}>
                    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:border-slate-300 hover:bg-white transition-colors">
                      {c.lineProfilePicUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.lineProfilePicUrl} alt={name} className="h-8 w-8 rounded-full object-cover border border-green-200 shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                        <p className="text-xs text-slate-400 truncate">{c.interestedPosition?.title ?? "ไม่ระบุตำแหน่ง"}</p>
                      </div>
                      <span className={`shrink-0 rounded-full text-[10px] font-semibold px-2 py-0.5 ${statusColors[c.currentStatus] ?? "bg-slate-100 text-slate-500"}`}>
                        {statusLabels[c.currentStatus] ?? c.currentStatus}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
