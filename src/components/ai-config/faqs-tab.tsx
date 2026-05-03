"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check } from "lucide-react";

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  isActive: boolean;
  sortOrder: number;
}

export function FaqsTab() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Faq> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/ai/faqs");
    if (res.ok) setFaqs(await res.json());
    setLoading(false);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    await fetch("/api/settings/ai/faqs", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(null);
    await load();
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this FAQ?")) return;
    await fetch("/api/settings/ai/faqs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function toggleActive(faq: Faq) {
    await fetch("/api/settings/ai/faqs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...faq, isActive: !faq.isActive }),
    });
    await load();
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">Knowledge / FAQ</h2>
          <p className="text-sm text-slate-500">คำถาม-ตอบที่ Bot จะใช้ตอบ candidate</p>
        </div>
        <button
          onClick={() => setForm({ isActive: true, sortOrder: faqs.length })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add FAQ
        </button>
      </div>

      <div className="space-y-2">
        {faqs.map((faq) => (
          <div key={faq.id} className={`bg-white border rounded-lg p-4 ${faq.isActive ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {faq.category && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{faq.category}</span>
                  )}
                  <p className="font-medium text-slate-800 text-sm">{faq.question}</p>
                </div>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{faq.answer}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleActive(faq)}
                  className={`p-1.5 rounded ${faq.isActive ? "text-green-600 hover:bg-green-50" : "text-slate-400 hover:bg-slate-50"}`}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setForm({ ...faq })} className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-50">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => remove(faq.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-slate-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {faqs.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
            No FAQs yet. Add the first one.
          </div>
        )}
      </div>

      {form !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{form.id ? "Edit FAQ" : "Add FAQ"}</h3>
              <button onClick={() => setForm(null)}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Category (optional)</label>
              <input
                value={form.category ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                placeholder="e.g. สวัสดิการ, ตำแหน่งงาน"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Question *</label>
              <input
                value={form.question ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                placeholder="คำถามที่ candidate มักถาม"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Answer *</label>
              <textarea
                value={form.answer ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                rows={4}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none"
                placeholder="คำตอบสำหรับ Bot"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={save} disabled={saving || !form.question || !form.answer} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
