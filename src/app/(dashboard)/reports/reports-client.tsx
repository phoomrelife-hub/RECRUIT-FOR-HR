"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Users, TrendingUp, CheckCircle2, Calendar } from "lucide-react";

export type ReportsData = {
  summary: {
    totalCandidates: number;
    thisMonthCount: number;
    lastMonthCount: number;
    passRate: number;
    interviewCompleteRate: number;
  };
  funnelData: { status: string; label: string; count: number; color: string }[];
  sourceData: { source: string; label: string; count: number; color: string }[];
  monthlyTrend: { month: string; count: number }[];
  positionData: { title: string; total: number; qualified: number; passed: number }[];
  interviewStatusData: { status: string; label: string; count: number; color: string }[];
  hiringOutcomeData: { result: string; label: string; count: number; color: string }[];
};

type BarTooltipProps = {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; fill?: string }>;
  label?: string;
};

function BarTooltip({ active, payload, label }: BarTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs">
      {label && <p className="font-medium text-slate-600 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? p.fill ?? "#3b82f6" }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

type PieItem = { label?: string; color?: string };
type PieTooltipProps = {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: PieItem }>;
};

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="font-medium" style={{ color: item.payload?.color ?? "#3b82f6" }}>
        {item.payload?.label}
      </p>
      <p className="text-slate-700">
        จำนวน: <span className="font-semibold">{item.value}</span>
      </p>
    </div>
  );
}

export function ReportsClient({ data }: { data: ReportsData }) {
  const {
    summary,
    funnelData,
    sourceData,
    monthlyTrend,
    positionData,
    interviewStatusData,
    hiringOutcomeData,
  } = data;

  const monthChange =
    summary.lastMonthCount > 0
      ? Math.round(
          ((summary.thisMonthCount - summary.lastMonthCount) / summary.lastMonthCount) * 100
        )
      : 0;

  const sourceFiltered = sourceData.filter((s) => s.count > 0);
  const interviewFiltered = interviewStatusData.filter((s) => s.count > 0);
  const hiringFiltered = hiringOutcomeData.filter((h) => h.count > 0);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Total Candidates"
          value={summary.totalCandidates}
          subtitle="All time"
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="This Month"
          value={summary.thisMonthCount}
          subtitle={`Last month: ${summary.lastMonthCount}`}
          icon={TrendingUp}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          trend={
            summary.lastMonthCount > 0
              ? { value: monthChange, label: "vs last month" }
              : undefined
          }
        />
        <StatCard
          title="Pass Rate"
          value={`${summary.passRate}%`}
          subtitle="Passed / Total candidates"
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          title="Interview Completion"
          value={`${summary.interviewCompleteRate}%`}
          subtitle="Completed / Total interviews"
          icon={Calendar}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Monthly Trend + Source Channel */}
      <div className="grid grid-cols-3 gap-6">
        {/* Monthly Trend */}
        <Card className="border-slate-200 col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Monthly Trend (6 เดือนล่าสุด)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="count" name="ผู้สมัคร" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Source Channel */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Source Channel</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceFiltered.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">ไม่มีข้อมูล</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={sourceFiltered}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      dataKey="count"
                      nameKey="label"
                    >
                      {sourceFiltered.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5">
                  {sourceFiltered.map((s) => (
                    <div key={s.source} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-slate-600">{s.label}</span>
                      </div>
                      <span className="font-semibold text-slate-800">{s.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recruitment Funnel */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Recruitment Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.totalCandidates === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีผู้สมัคร</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 4, right: 40, left: 4, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={130}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="count" name="จำนวน" radius={[0, 4, 4, 0]}>
                  {funnelData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Interview Stats + Hiring Outcomes */}
      <div className="grid grid-cols-2 gap-6">
        {/* Interview Status */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Interview Status</CardTitle>
          </CardHeader>
          <CardContent>
            {interviewFiltered.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                ยังไม่มีการนัดสัมภาษณ์
              </p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={interviewFiltered}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      dataKey="count"
                      nameKey="label"
                    >
                      {interviewFiltered.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {interviewFiltered.map((s) => (
                    <div key={s.status} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-slate-600">{s.label}</span>
                      <span className="ml-auto font-semibold text-slate-800">{s.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Hiring Outcomes */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Hiring Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            {hiringFiltered.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                ยังไม่มีการตัดสินใจจ้างงาน
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={hiringFiltered}
                  margin={{ top: 4, right: 4, left: -20, bottom: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip content={<BarTooltip />} />
                  <Bar dataKey="count" name="จำนวน" radius={[4, 4, 0, 0]}>
                    {hiringFiltered.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By Job Position */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">By Job Position</CardTitle>
        </CardHeader>
        <CardContent>
          {positionData.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีตำแหน่งงาน</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-left font-medium text-slate-500">Position</th>
                  <th className="pb-3 text-center font-medium text-slate-500">Total</th>
                  <th className="pb-3 text-center font-medium text-slate-500">Qualified+</th>
                  <th className="pb-3 text-center font-medium text-slate-500">Passed</th>
                  <th className="pb-3 text-center font-medium text-slate-500">Pass Rate</th>
                </tr>
              </thead>
              <tbody>
                {positionData.map((p, i) => {
                  const rate =
                    p.total > 0
                      ? ((p.passed / p.total) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="py-3 font-medium text-slate-800">{p.title}</td>
                      <td className="py-3 text-center text-slate-600">{p.total}</td>
                      <td className="py-3 text-center font-medium text-blue-600">
                        {p.qualified}
                      </td>
                      <td className="py-3 text-center font-medium text-green-600">
                        {p.passed}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`font-semibold ${
                            parseFloat(rate) >= 20
                              ? "text-green-600"
                              : parseFloat(rate) >= 10
                              ? "text-amber-600"
                              : "text-slate-400"
                          }`}
                        >
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
