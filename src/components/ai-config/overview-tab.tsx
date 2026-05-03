"use client";

import { useEffect, useState } from "react";
import { Bot, Zap, FileText, BookOpen, ShieldCheck, Bell, Tag, BarChart3, TrendingUp } from "lucide-react";

interface OverviewData {
  activeProvider: { id: string; name: string; displayName: string; defaultModel?: string | null } | null;
  publishedPromptVersion: { version: number; title: string; publishedAt: string | null } | null;
  persona: { botName: string; tone: string } | null;
  stats: {
    activeFaqs: number;
    activeTemplates: number;
    activeGuardrails: number;
    activeHandoffRules: number;
    activeTaggingRules: number;
    totalTokensUsed: number;
    totalCostUsd: number;
  };
  recentLogs: { id: string; action: string; model: string | null; totalTokens: number | null; success: boolean; createdAt: string }[];
}

export function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/ai/overview")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Status cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatusCard
          icon={<Bot className="h-5 w-5 text-blue-600" />}
          label="Active Provider"
          value={data.activeProvider?.displayName ?? "Not configured"}
          sub={data.activeProvider?.defaultModel ?? ""}
          ok={!!data.activeProvider}
        />
        <StatusCard
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          label="Published Prompt"
          value={data.publishedPromptVersion ? `v${data.publishedPromptVersion.version}` : "None"}
          sub={data.publishedPromptVersion?.title ?? "No published version"}
          ok={!!data.publishedPromptVersion}
        />
        <StatusCard
          icon={<Zap className="h-5 w-5 text-blue-600" />}
          label="Bot Name"
          value={data.persona?.botName ?? "Daniel"}
          sub={`Tone: ${data.persona?.tone ?? "professional"}`}
          ok
        />
        <StatusCard
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          label="Total Cost"
          value={`$${(data.stats.totalCostUsd).toFixed(4)}`}
          sub={`${data.stats.totalTokensUsed.toLocaleString()} tokens`}
          ok
        />
      </div>

      {/* Config stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { icon: <BookOpen className="h-4 w-4" />, label: "FAQs", value: data.stats.activeFaqs },
          { icon: <FileText className="h-4 w-4" />, label: "Templates", value: data.stats.activeTemplates },
          { icon: <ShieldCheck className="h-4 w-4" />, label: "Guardrails", value: data.stats.activeGuardrails },
          { icon: <Bell className="h-4 w-4" />, label: "Handoff Rules", value: data.stats.activeHandoffRules },
          { icon: <Tag className="h-4 w-4" />, label: "Tagging Rules", value: data.stats.activeTaggingRules },
        ].map((item) => (
          <div key={item.label} className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
            <div className="text-slate-500">{item.icon}</div>
            <div>
              <div className="text-xl font-bold text-slate-800">{item.value}</div>
              <div className="text-xs text-slate-500">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent logs */}
      {data.recentLogs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-500" />
            <h3 className="font-medium text-slate-700">Recent AI Activity</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentLogs.map((log) => (
              <div key={log.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${log.success ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-slate-700">{log.action}</span>
                  {log.model && <span className="text-slate-400 text-xs">— {log.model}</span>}
                </div>
                <div className="text-slate-400 text-xs">
                  {log.totalTokens ? `${log.totalTokens} tokens` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCard({ icon, label, value, sub, ok }: { icon: React.ReactNode; label: string; value: string; sub: string; ok: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <div className="font-semibold text-slate-800">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{sub}</div>
      <div className={`mt-2 text-xs font-medium ${ok ? "text-green-600" : "text-amber-600"}`}>
        {ok ? "● Configured" : "● Not configured"}
      </div>
    </div>
  );
}
