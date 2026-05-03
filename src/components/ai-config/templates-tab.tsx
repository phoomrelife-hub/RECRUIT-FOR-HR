"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, X, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

interface Template {
  id: string;
  name: string;
  trigger: string | null;
  content: string;
  isActive: boolean;
}

export function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Template> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/ai/templates");
    if (res.ok) setTemplates(await res.json());
    setLoading(false);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    await fetch("/api/settings/ai/templates", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(null);
    await load();
    setSaving(false);
  }

  async function remove(id: string) {
    await fetch("/api/settings/ai/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function toggle(t: Template) {
    await fetch("/api/settings/ai/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...t, isActive: !t.isActive }),
    });
    await load();
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">Response Templates</h2>
          <p className="text-sm text-slate-500">ข้อความสำเร็จรูปที่ Bot ใช้</p>
        </div>
        <button
          onClick={() => setForm({ isActive: true })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Template
        </button>
      </div>

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className={`bg-white border rounded-lg p-4 flex items-start gap-3 ${t.isActive ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
            <button onClick={() => toggle(t)} className={t.isActive ? "text-blue-600 mt-0.5" : "text-slate-300 mt-0.5"}>
              {t.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800 text-sm">{t.name}</span>
                {t.trigger && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">trigger: {t.trigger}</span>}
              </div>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{t.content}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => setForm({ ...t })} className="p-1 text-slate-400 hover:text-blue-500">✏️</button>
              <button onClick={() => remove(t.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
            No templates yet
          </div>
        )}
      </div>

      {form !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{form.id ? "Edit Template" : "Add Template"}</h3>
              <button onClick={() => setForm(null)}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Name *</label>
              <input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" placeholder="เช่น: ทักทายตอนเช้า" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Trigger keyword (optional)</label>
              <input value={form.trigger ?? ""} onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" placeholder="keyword ที่จะ trigger template นี้" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Content *</label>
              <textarea value={form.content ?? ""} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={4} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none" placeholder="ข้อความที่จะส่ง..." />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 rounded-md text-sm">Cancel</button>
              <button onClick={save} disabled={saving || !form.name || !form.content} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
