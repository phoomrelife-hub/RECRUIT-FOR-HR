"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";

interface AiLog {
  id: string;
  action: string;
  model: string | null;
  totalTokens: number | null;
  costEstimate: number | null;
  latencyMs: number | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface LogStats {
  total: number;
  errors: number;
  successRate: number;
  totalTokens: number;
  totalCostUsd: number;
  byAction: { action: string; count: number; tokens: number; cost: number }[];
}

export function LogsTab() {
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [logsRes, statsRes] = await Promise.all([
      fetch("/api/settings/ai/logs"),
      fetch("/api/settings/ai/logs?stats=true"),
    ]);
    if (logsRes.ok) {
      const data = await logsRes.json();
      setLogs(data.logs ?? []);
    }
    if (statsRes.ok) setStats(await statsRes.json());
    setLoading(false);
  }

  const filtered = filter
    ? logs.filter((l) => l.action.includes(filter) || l.model?.includes(filter))
    : logs;

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Requests", value: stats.total },
            { label: "Success Rate", value: `${stats.successRate.toFixed(1)}%` },
            { label: "Total Tokens", value: stats.totalTokens.toLocaleString() },
            { label: "Total Cost", value: `$${stats.totalCostUsd.toFixed(4)}` },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xl font-bold text-slate-800">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by action or model..."
          className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm"
        />
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-600 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {["Action", "Model", "Tokens", "Cost", "Latency", "Status", "Time"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 50).map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">{log.action}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{log.model ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{log.totalTokens ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{log.costEstimate != null ? `$${log.costEstimate.toFixed(6)}` : "—"}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{log.latencyMs != null ? `${log.latencyMs}ms` : "—"}</td>
                <td className="px-4 py-2.5">
                  {log.success
                    ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                </td>
                <td className="px-4 py-2.5 text-slate-400 text-xs">{new Date(log.createdAt).toLocaleString("th-TH")}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">No logs found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
