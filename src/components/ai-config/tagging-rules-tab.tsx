"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, X, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

interface TaggingRule {
  id: string;
  name: string;
  condition: string;
  tagId: string | null;
  tagName: string | null;
  isActive: boolean;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

export function TaggingRulesTab() {
  const [rules, setRules] = useState<TaggingRule[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<TaggingRule> & { field?: string; operator?: string; value?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/ai/tagging-rules").then((r) => r.json()),
      fetch("/api/tags").then((r) => r.json()),
    ]).then(([rulesData, tagsData]) => {
      setRules(rulesData ?? []);
      setTags(tagsData ?? []);
    }).finally(() => setLoading(false));
  }, []);

  function buildCondition() {
    if (!form) return "{}";
    return JSON.stringify({ field: form.field, operator: form.operator, value: form.value });
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    const tag = tags.find((t) => t.id === form.tagId);
    await fetch("/api/settings/ai/tagging-rules", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, condition: buildCondition(), tagName: tag?.name ?? form.tagName }),
    });
    setForm(null);
    const res = await fetch("/api/settings/ai/tagging-rules");
    if (res.ok) setRules(await res.json());
    setSaving(false);
  }

  async function remove(id: string) {
    await fetch("/api/settings/ai/tagging-rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const res = await fetch("/api/settings/ai/tagging-rules");
    if (res.ok) setRules(await res.json());
  }

  async function toggle(rule: TaggingRule) {
    await fetch("/api/settings/ai/tagging-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rule, isActive: !rule.isActive }),
    });
    const res = await fetch("/api/settings/ai/tagging-rules");
    if (res.ok) setRules(await res.json());
  }

  function parseCondition(cond: string) {
    try { return JSON.parse(cond); } catch { return {}; }
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">Auto Tagging Rules</h2>
          <p className="text-sm text-slate-500">กำหนดเงื่อนไขให้ Bot ติด Tag อัตโนมัติ</p>
        </div>
        <button
          onClick={() => setForm({ isActive: true, field: "experienceStatus", operator: "equals", value: "" })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      </div>

      <div className="space-y-2">
        {rules.map((rule) => {
          const cond = parseCondition(rule.condition);
          return (
            <div key={rule.id} className={`bg-white border rounded-lg p-4 flex items-center gap-3 ${rule.isActive ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
              <button onClick={() => toggle(rule)} className={rule.isActive ? "text-blue-600" : "text-slate-300"}>
                {rule.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
              </button>
              <div className="flex-1">
                <p className="font-medium text-slate-800 text-sm">{rule.name}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  <span className="bg-slate-100 px-2 py-0.5 rounded">{cond.field} {cond.operator} <b>{cond.value}</b></span>
                  <span>→ tag:</span>
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{rule.tagName ?? "Unknown"}</span>
                </div>
              </div>
              <button onClick={() => remove(rule.id)} className="p-1 text-slate-400 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        {rules.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">No tagging rules yet</div>
        )}
      </div>

      {form !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Add Tagging Rule</h3>
              <button onClick={() => setForm(null)}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Rule Name</label>
              <input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Field</label>
                <select value={form.field ?? "experienceStatus"} onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm">
                  {["experienceStatus", "expectedSalary", "workPreference", "sourceChannel"].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Operator</label>
                <select value={form.operator ?? "equals"} onChange={(e) => setForm((f) => ({ ...f, operator: e.target.value }))} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm">
                  {["equals", "contains", "greater_than", "less_than"].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Value</label>
                <input value={form.value ?? ""} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Apply Tag</label>
              <select value={form.tagId ?? ""} onChange={(e) => setForm((f) => ({ ...f, tagId: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm">
                <option value="">Select tag</option>
                {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 rounded-md text-sm">Cancel</button>
              <button onClick={save} disabled={saving || !form.name || !form.tagId} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
