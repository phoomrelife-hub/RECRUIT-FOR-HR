"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, X, Trash2, Globe } from "lucide-react";

interface PositionRule {
  id?: string;
  jobPositionId: string | null;
  isGlobal: boolean;
  rule: string;
  sortOrder: number;
}

interface Job {
  id: string;
  title: string;
}

export function PositionRulesTab() {
  const [rules, setRules] = useState<PositionRule[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<PositionRule> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/ai/position-rules").then((r) => r.json()),
      fetch("/api/jobs").then((r) => r.json()),
    ]).then(([rulesData, jobsData]) => {
      setRules(rulesData);
      setJobs(jobsData?.jobs ?? jobsData ?? []);
    }).finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!form) return;
    setSaving(true);
    await fetch("/api/settings/ai/position-rules", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(null);
    const res = await fetch("/api/settings/ai/position-rules");
    if (res.ok) setRules(await res.json());
    setSaving(false);
  }

  async function remove(id: string) {
    await fetch("/api/settings/ai/position-rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const res = await fetch("/api/settings/ai/position-rules");
    if (res.ok) setRules(await res.json());
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  const globalRules = rules.filter((r) => r.isGlobal);
  const positionRules = rules.filter((r) => !r.isGlobal);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">Position Rules</h2>
          <p className="text-sm text-slate-500">กฎ AI เฉพาะแต่ละตำแหน่งงาน หรือกฎ Global</p>
        </div>
        <button
          onClick={() => setForm({ isGlobal: false, jobPositionId: null, sortOrder: rules.length })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      </div>

      {globalRules.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Global Rules
          </h3>
          <div className="space-y-2">
            {globalRules.map((rule) => (
              <RuleCard key={rule.id} rule={rule} onEdit={() => setForm({ ...rule })} onDelete={() => remove(rule.id!)} />
            ))}
          </div>
        </div>
      )}

      {positionRules.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-600 mb-2">Position-Specific Rules</h3>
          <div className="space-y-2">
            {positionRules.map((rule) => {
              const job = jobs.find((j) => j.id === rule.jobPositionId);
              return <RuleCard key={rule.id} rule={rule} jobName={job?.title} onEdit={() => setForm({ ...rule })} onDelete={() => remove(rule.id!)} />;
            })}
          </div>
        </div>
      )}

      {rules.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
          No position rules yet
        </div>
      )}

      {form !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{form.id ? "Edit Rule" : "Add Rule"}</h3>
              <button onClick={() => setForm(null)}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isGlobal" checked={form.isGlobal ?? false} onChange={(e) => setForm((f) => ({ ...f, isGlobal: e.target.checked, jobPositionId: null }))} />
              <label htmlFor="isGlobal" className="text-sm text-slate-700">Global rule (applies to all positions)</label>
            </div>
            {!form.isGlobal && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Job Position</label>
                <select
                  value={form.jobPositionId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, jobPositionId: e.target.value || null }))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select position</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Rule *</label>
              <textarea
                value={form.rule ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, rule: e.target.value }))}
                rows={3}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none"
                placeholder="เช่น: สำหรับตำแหน่งนี้ ต้องถามประสบการณ์ขั้นต่ำ 2 ปี"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 rounded-md text-sm">Cancel</button>
              <button onClick={save} disabled={saving || !form.rule} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleCard({ rule, jobName, onEdit, onDelete }: { rule: PositionRule; jobName?: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-3">
      <div className="flex-1">
        {jobName && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full mb-1 inline-block">{jobName}</span>}
        <p className="text-sm text-slate-700">{rule.rule}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={onEdit} className="p-1 text-slate-400 hover:text-blue-500">✏️</button>
        <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
