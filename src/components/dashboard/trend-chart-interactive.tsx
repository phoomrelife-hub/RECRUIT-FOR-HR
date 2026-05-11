"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type Period = "daily" | "weekly" | "monthly";

const PERIOD_CONFIG: Record<Period, { label: string; subtitle: string; xInterval: number }> = {
  daily:   { label: "รายวัน",      subtitle: "30 วันล่าสุด",      xInterval: 4 },
  weekly:  { label: "รายสัปดาห์",  subtitle: "12 สัปดาห์ล่าสุด",  xInterval: 2 },
  monthly: { label: "รายเดือน",    subtitle: "6 เดือนล่าสุด",      xInterval: 0 },
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
};

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-slate-600">{label}</p>
      <p className="text-blue-600 font-semibold">{payload[0]?.value} คน</p>
    </div>
  );
}

interface Props {
  /** Height of the chart in px (default 180) */
  height?: number;
  /** Show the section title/subtitle row (default true) */
  showHeader?: boolean;
  /** Show the "รวม N คน" badge (default true) */
  showTotal?: boolean;
  /** Initial period (default monthly) */
  defaultPeriod?: Period;
}

export function TrendChartInteractive({
  height = 180,
  showHeader = true,
  showTotal = true,
  defaultPeriod = "monthly",
}: Props) {
  const [period, setPeriod]   = useState<Period>(defaultPeriod);
  const [data, setData]       = useState<{ label: string; count: number }[]>([]);
  const [total, setTotal]     = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/dashboard/trend?period=${p}`);
      const json = await res.json();
      setData(json.data  ?? []);
      setTotal(json.total ?? 0);
    } catch {
      // silent — keep previous data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(period); }, [period, fetchData]);

  const cfg = PERIOD_CONFIG[period];

  return (
    <div>
      {/* ── Header row ── */}
      <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
        {showHeader && (
          <div>
            <h3 className="text-sm font-semibold text-slate-800">ผู้สมัคร{cfg.label}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{cfg.subtitle}</p>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {showTotal && (
            <span className="rounded-full bg-blue-50 text-blue-600 text-xs font-semibold px-3 py-1 shrink-0">
              {loading ? "..." : `รวม ${total} คน`}
            </span>
          )}

          {/* Period toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
            {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {PERIOD_CONFIG[p].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chart / Loader ── */}
      {loading ? (
        <div
          className="flex items-center justify-center text-slate-300"
          style={{ height }}
        >
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              interval={cfg.xInterval}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
