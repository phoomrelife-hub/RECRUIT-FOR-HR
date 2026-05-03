"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, X, ToggleLeft, ToggleRight } from "lucide-react";

interface HandoffRule {
  id: string;
  name: string;
  triggerType: string;
  triggerValue: string;
  action: string;
  isActive: boolean;
}

const TRIGGER_TYPES = [
  { value: "keyword", label: "Keyword" },
  { value: "sentiment", label: "Negative Sentiment" },
  { value: "message_count", label: "Message Count" },
  { value: "time", label: "Response Time" },
];

const ACTIONS = [
  { value: "notify_hr", label: "Notify HR only" },
  { value: "pause_bot", label: "Pause Bot" },
  { value: "notify_and_pause", label: "Notify HR + Pause Bot" },
];

export function HandoffRulesTab() {
  const [rules, setRules] = useState<HandoffRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<HandoffRule> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/ai/handoff-rules");
    if (res.ok) setRules(await res.json());
    setLoading(false);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    await fetch("/api/settings/ai/handoff-rules", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(null);
    await load();
    setSaving(false);
  }

  async function remove(id: string) {
    await fetch("/api/settings/ai/handoff-rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function toggle(rule: HandoffRule) {
    await fetch("/api/settings/ai/handoff-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rule, isActive: !rule.isActive }),
    });
    await load();
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">Handoff Rules</h2>
          <p className="text-sm text-slate-500">เงื่อนไขที่จะส่งต่อให้ HR รับช่วงต่อ</p>
        </div>
        <button
          onClick={() => setForm({ triggerType: "keyword", action: "notify_and_pause", isActive: true })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      </div>

      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} className={`bg-white border rounded-lg p-4 flex items-center gap-3 ${rule.isActive ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
            <button onClick={() => toggle(rule)} className={rule.isActive ? "text-blue-600" : "text-slate-300"}>
              {rule.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
            </button>
            <div className="flex-1">
              <p className="font-medium text-slate-800 text-sm">{rule.name}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span className="bg-slate-100 px-2 py-0.5 rounded">{rule.triggerType}: <b>{rule.triggerValue}</b></span>
                <span>→</span>
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">{ACTIONS.find((a) => a.value === rule.action)?.label ?? rule.action}</span>
              </div>
            </div>
            <button onClick={() => setForm({ ...rule })} className="p-1 text-slate-400 hover:text-blue-500">
              <Loader2 className="h-3.5 w-3.5 hidden" />✏️
            </button>
            <button onClick={() => remove(rule.id)} className="p-1 text-slate-400 hover:text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {rules.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
            No handoff rules yet
          </div>
        )}
      </div>

      {form !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{form.id ? "Edit Rule" : "Add Handoff Rule"}</h3>
              <button onClick={() => setForm(null)}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            {[
              { key: "name", label: "Rule Name", placeholder: "e.g. Angry keyword trigger" },
              { key: "triggerValue", label: "Trigger Value", placeholder: "e.g. ผู้จัดการ,คุย,angry" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-medium text-slate-700">{label}</label>
                <input
                  value={(form as Record<string, string>)[key] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                  placeholder={placeholder}
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Trigger Type</label>
                <select
                  value={form.triggerType ?? "keyword"}
                  onChange={(e) => setForm((f) => ({ ...f, triggerType: e.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                >
                  {TRIGGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Action</label>
                <select
                  value={form.action ?? "notify_and_pause"}
                  onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                >
                  {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 rounded-md text-sm">Cancel</button>
              <button onClick={save} disabled={saving || !form.name || !form.triggerValue} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
