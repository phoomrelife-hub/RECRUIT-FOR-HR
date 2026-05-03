"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, X, Trash2, Star } from "lucide-react";

interface SummaryTemplate {
  id: string;
  name: string;
  template: string;
  isDefault: boolean;
}

const DEFAULT_TEMPLATE = `## สรุปผู้สมัคร

**ชื่อ:** {fullName}
**ตำแหน่งที่สนใจ:** {position}

### ข้อมูลเบื้องต้น
- ประสบการณ์: {experienceStatus}
- เงินเดือนที่คาดหวัง: {expectedSalary}
- ความพร้อม: {availability}

### จุดแข็ง
{strengths}

### ข้อกังวล
{concerns}

### คำแนะนำ
{recommendation}

### Next Action
{nextAction}`;

export function SummaryTemplatesTab() {
  const [templates, setTemplates] = useState<SummaryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<SummaryTemplate> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/ai/summary-templates");
    if (res.ok) setTemplates(await res.json());
    setLoading(false);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    await fetch("/api/settings/ai/summary-templates", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(null);
    await load();
    setSaving(false);
  }

  async function remove(id: string) {
    await fetch("/api/settings/ai/summary-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">Summary Templates</h2>
          <p className="text-sm text-slate-500">Template สำหรับสรุป AI Summary ของ candidate</p>
        </div>
        <button
          onClick={() => setForm({ isDefault: false, template: DEFAULT_TEMPLATE })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Template
        </button>
      </div>

      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {t.isDefault && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                <span className="font-medium text-slate-800 text-sm">{t.name}</span>
                {t.isDefault && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Default</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setForm({ ...t })} className="px-2 py-1 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50">Edit</button>
                <button onClick={() => remove(t.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <pre className="text-xs text-slate-500 whitespace-pre-wrap line-clamp-4 font-mono">{t.template}</pre>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
            No summary templates yet
          </div>
        )}
      </div>

      {form !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{form.id ? "Edit Template" : "Add Template"}</h3>
              <button onClick={() => setForm(null)}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Name *</label>
              <input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Template *</label>
              <p className="text-xs text-slate-400">ใช้ {`{variable}`} สำหรับ dynamic content</p>
              <textarea
                value={form.template ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}
                rows={12}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm font-mono resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isDefault" checked={form.isDefault ?? false} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
              <label htmlFor="isDefault" className="text-sm text-slate-700">Set as default template</label>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 rounded-md text-sm">Cancel</button>
              <button onClick={save} disabled={saving || !form.name || !form.template} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
