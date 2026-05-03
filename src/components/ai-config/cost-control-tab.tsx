"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, AlertTriangle } from "lucide-react";

interface CostPeriod {
  cost: number;
  tokens: number;
}

interface LimitInfo {
  limit: number;
  used: number;
  percent: number;
  alertAt: number | null;
}

interface CostData {
  daily: CostPeriod;
  weekly: CostPeriod;
  monthly: CostPeriod;
  limits: {
    monthly: LimitInfo | null;
    daily: LimitInfo | null;
  };
}

export function CostControlTab() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthlyLimit, setMonthlyLimit] = useState("10");
  const [dailyLimit, setDailyLimit] = useState("1");
  const [alertAt, setAlertAt] = useState("80");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/ai/cost-control")
      .then((r) => r.json())
      .then((d: CostData) => {
        setData(d);
        if (d.limits.monthly) setMonthlyLimit(String(d.limits.monthly.limit));
        if (d.limits.daily) setDailyLimit(String(d.limits.daily.limit));
        if (d.limits.monthly?.alertAt) setAlertAt(String(d.limits.monthly.alertAt));
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(period: "monthly" | "daily") {
    setSaving(true);
    await fetch("/api/settings/ai/cost-control", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period,
        limitUsd: parseFloat(period === "monthly" ? monthlyLimit : dailyLimit),
        alertAt: period === "monthly" ? parseFloat(alertAt) : undefined,
      }),
    });
    const res = await fetch("/api/settings/ai/cost-control");
    if (res.ok) setData(await res.json());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-semibold text-slate-800">Cost Control</h2>
        <p className="text-sm text-slate-500">ติดตามและจำกัดค่าใช้จ่าย AI</p>
      </div>

      {/* Usage summary */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Today", period: data.daily },
            { label: "This Week", period: data.weekly },
            { label: "This Month", period: data.monthly },
          ].map(({ label, period }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="text-lg font-bold text-slate-800 mt-1">${period.cost.toFixed(4)}</div>
              <div className="text-xs text-slate-400">{period.tokens.toLocaleString()} tokens</div>
            </div>
          ))}
        </div>
      )}

      {/* Monthly limit */}
      {data?.limits.monthly && data.limits.monthly.percent > 80 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Monthly budget at {data.limits.monthly.percent.toFixed(0)}% — consider reviewing usage
        </div>
      )}

      {data?.limits.monthly && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Monthly Budget</span>
            <span className="text-sm text-slate-500">${data.limits.monthly.used.toFixed(4)} / ${data.limits.monthly.limit}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${data.limits.monthly.percent > 80 ? "bg-amber-500" : "bg-blue-500"}`}
              style={{ width: `${Math.min(data.limits.monthly.percent, 100)}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 mt-1">{data.limits.monthly.percent.toFixed(1)}% used</div>
        </div>
      )}

      {/* Limit settings */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h3 className="font-medium text-slate-700">Set Limits</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Daily Limit (USD)</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                step="0.1"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm"
              />
              <button onClick={() => save("daily")} disabled={saving} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Monthly Limit (USD)</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                step="1"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm"
              />
              <button onClick={() => save("monthly")} disabled={saving} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Alert at (% of monthly limit)</label>
          <div className="flex items-center gap-3">
            <input type="range" min="50" max="100" value={alertAt} onChange={(e) => setAlertAt(e.target.value)} className="flex-1" />
            <span className="text-sm text-slate-600 w-12">{alertAt}%</span>
          </div>
        </div>
      </div>

      {saved && <p className="text-green-600 text-sm">Saved!</p>}
    </div>
  );
}
