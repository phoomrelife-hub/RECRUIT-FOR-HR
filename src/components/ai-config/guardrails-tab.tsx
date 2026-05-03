"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, X, ToggleLeft, ToggleRight } from "lucide-react";

interface Guardrail {
  id: string;
  type: string;
  description: string;
  value: string | null;
  isActive: boolean;
}

const TYPES = [
  { value: "blocked_topic", label: "Blocked Topic", hint: "หัวข้อที่ห้าม bot พูดถึง" },
  { value: "required_disclosure", label: "Required Disclosure", hint: "ข้อความที่ต้องแจ้งเสมอ" },
  { value: "max_messages", label: "Max Messages", hint: "จำกัดจำนวนข้อความก่อน handoff" },
  { value: "off_hours", label: "Off-Hours Message", hint: "ข้อความนอกเวลาทำการ" },
];

export function GuardrailsTab() {
  const [items, setItems] = useState<Guardrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Guardrail> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/ai/guardrails");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    await fetch("/api/settings/ai/guardrails", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(null);
    await load();
    setSaving(false);
  }

  async function remove(id: string) {
    await fetch("/api/settings/ai/guardrails", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function toggle(item: Guardrail) {
    await fetch("/api/settings/ai/guardrails", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, isActive: !item.isActive }),
    });
    await load();
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">Guardrails</h2>
          <p className="text-sm text-slate-500">กฎที่ควบคุมพฤติกรรม Bot</p>
        </div>
        <button
          onClick={() => setForm({ type: "blocked_topic", isActive: true })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Guardrail
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const typeInfo = TYPES.find((t) => t.value === item.type);
          return (
            <div key={item.id} className={`bg-white border rounded-lg p-4 flex items-center gap-3 ${item.isActive ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
              <button onClick={() => toggle(item)} className={item.isActive ? "text-blue-600" : "text-slate-300"}>
                {item.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{typeInfo?.label ?? item.type}</span>
                </div>
                <p className="text-sm text-slate-800 mt-1">{item.description}</p>
                {item.value && <p className="text-xs text-slate-400 mt-0.5">{item.value}</p>}
              </div>
              <button onClick={() => remove(item.id)} className="p-1 text-slate-400 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
            No guardrails configured
          </div>
        )}
      </div>

      {form !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Add Guardrail</h3>
              <button onClick={() => setForm(null)}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Type</label>
              <select
                value={form.type ?? "blocked_topic"}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              >
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label} — {t.hint}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Description *</label>
              <input
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                placeholder="อธิบายกฎนี้..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Value (optional)</label>
              <input
                value={form.value ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                placeholder="e.g. keyword, จำนวน, ข้อความ"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 rounded-md text-sm">Cancel</button>
              <button onClick={save} disabled={saving || !form.description} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
