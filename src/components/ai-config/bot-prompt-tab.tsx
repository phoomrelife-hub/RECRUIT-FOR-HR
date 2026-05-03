"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Check,
  Pencil,
  X,
  Save,
  Upload,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PromptVersion {
  id: string;
  version: number;
  title: string;
  content: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
}

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  isActive: boolean;
}

interface Template {
  id: string;
  name: string;
  trigger: string | null;
  content: string;
  isActive: boolean;
}

interface Guardrail {
  id: string;
  type: string;
  description: string;
  value: string | null;
  isActive: boolean;
}

const GUARDRAIL_TYPES = [
  { value: "blocked_topic", label: "Blocked Topic" },
  { value: "required_disclosure", label: "Required Disclosure" },
  { value: "max_messages", label: "Max Messages" },
  { value: "off_hours", label: "Off-Hours Message" },
];

// ─── Accordion wrapper ────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
          <div className="text-left">
            <div className="font-medium text-slate-800 text-sm">{title}</div>
            {subtitle && (
              <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>
            )}
          </div>
        </div>
        {count !== undefined && (
          <span className="text-xs text-slate-400 mr-2">{count} รายการ</span>
        )}
      </button>
      {open && <div className="border-t border-slate-100 p-4">{children}</div>}
    </div>
  );
}

// ─── System Prompt section ────────────────────────────────────────────────────

function SystemPromptSection() {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [publishedVersion, setPublishedVersion] =
    useState<PromptVersion | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/settings/ai/prompts");
    if (!res.ok) return;
    const data: PromptVersion[] = await res.json();
    setPrompts(data);
    const pub = data.find((p) => p.status === "PUBLISHED");
    const draft = data.find((p) => p.status === "DRAFT");
    const active = draft ?? pub ?? data[0];
    if (active) {
      setContent(active.content);
      setTitle(active.title);
    }
    if (pub) setPublishedVersion(pub);
  }

  const autoSave = useCallback(
    (newContent: string, newTitle: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const draft = prompts.find((p) => p.status === "DRAFT");
        if (draft) {
          await fetch(`/api/settings/ai/prompts/${draft.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle, content: newContent }),
          });
        } else {
          await fetch("/api/settings/ai/prompts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle, content: newContent }),
          });
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        await load();
      }, 2000);
    },
    [prompts]
  );

  function handleChange(newContent: string) {
    setContent(newContent);
    autoSave(newContent, title);
  }

  async function publish() {
    const draft = prompts.find((p) => p.status === "DRAFT");
    if (!draft) {
      // save first then publish
      setSaving(true);
      const res = await fetch("/api/settings/ai/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const newDraft = await res.json();
      setSaving(false);
      setPublishing(true);
      await fetch(`/api/settings/ai/prompts/${newDraft.id}/publish`, {
        method: "POST",
      });
    } else {
      setPublishing(true);
      await fetch(`/api/settings/ai/prompts/${draft.id}/publish`, {
        method: "POST",
      });
    }
    await load();
    setPublishing(false);
  }

  const charCount = content.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {publishedVersion && (
            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
              Published: v{publishedVersion.version}
            </span>
          )}
          {saved && (
            <span className="text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" /> Auto-saved
            </span>
          )}
          {saving && (
            <span className="text-slate-400 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
        </div>
        <button
          onClick={publish}
          disabled={publishing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs hover:bg-green-700 disabled:opacity-50"
        >
          {publishing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          Publish
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          autoSave(content, e.target.value);
        }}
        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
        placeholder="Version title..."
      />
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        rows={10}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
        placeholder="เขียน System Prompt ที่นี่..."
      />
      <div className="text-right text-xs text-slate-400">
        {charCount.toLocaleString()} ตัวอักษร
      </div>
    </div>
  );
}

// ─── FAQs section ─────────────────────────────────────────────────────────────

function FaqsSection() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Faq> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

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

  if (loading) return <div className="h-12 animate-pulse bg-slate-100 rounded" />;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setForm({ isActive: true })}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-300 text-slate-500 rounded-md text-sm hover:border-blue-400 hover:text-blue-600 w-full justify-center"
      >
        <Plus className="h-3.5 w-3.5" /> เพิ่ม FAQ
      </button>

      <div className="space-y-2">
        {faqs.map((faq) => (
          <div
            key={faq.id}
            className={`border rounded-lg p-3 ${faq.isActive ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}
          >
            <div className="flex items-start gap-2">
              <button
                onClick={() => toggleActive(faq)}
                className={faq.isActive ? "text-green-500 mt-0.5" : "text-slate-300 mt-0.5"}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {faq.category && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded shrink-0">
                      {faq.category}
                    </span>
                  )}
                  <p className="font-medium text-slate-800 text-sm truncate">{faq.question}</p>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{faq.answer}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setForm({ ...faq })} className="p-1 text-slate-400 hover:text-blue-500">
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={() => remove(faq.id)} className="p-1 text-slate-400 hover:text-red-500">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {faqs.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-4">ยังไม่มี FAQ</p>
        )}
      </div>

      {form !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{form.id ? "แก้ไข FAQ" : "เพิ่ม FAQ"}</h3>
              <button onClick={() => setForm(null)}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">หมวด (optional)</label>
              <input value={form.category ?? ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" placeholder="เช่น สวัสดิการ, ตำแหน่งงาน" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">คำถาม *</label>
              <input value={form.question ?? ""} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">คำตอบ *</label>
              <textarea value={form.answer ?? ""} onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} rows={4} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 rounded-md text-sm">ยกเลิก</button>
              <button onClick={save} disabled={saving || !form.question || !form.answer} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Response Templates section ───────────────────────────────────────────────

function TemplatesSection() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Template> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

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

  if (loading) return <div className="h-12 animate-pulse bg-slate-100 rounded" />;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setForm({ isActive: true })}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-300 text-slate-500 rounded-md text-sm hover:border-blue-400 hover:text-blue-600 w-full justify-center"
      >
        <Plus className="h-3.5 w-3.5" /> เพิ่ม Template
      </button>

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className={`border rounded-lg p-3 flex items-start gap-2 ${t.isActive ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
            <button onClick={() => toggle(t)} className={t.isActive ? "text-blue-600 mt-0.5" : "text-slate-300 mt-0.5"}>
              {t.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-800 text-sm">{t.name}</span>
                {t.trigger && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">trigger: {t.trigger}</span>}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{t.content}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => setForm({ ...t })} className="p-1 text-slate-400 hover:text-blue-500"><Pencil className="h-3 w-3" /></button>
              <button onClick={() => remove(t.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
            </div>
          </div>
        ))}
        {templates.length === 0 && <p className="text-center text-xs text-slate-400 py-4">ยังไม่มี Template</p>}
      </div>

      {form !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{form.id ? "แก้ไข Template" : "เพิ่ม Template"}</h3>
              <button onClick={() => setForm(null)}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">ชื่อ *</label>
              <input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Trigger keyword (optional)</label>
              <input value={form.trigger ?? ""} onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">ข้อความ *</label>
              <textarea value={form.content ?? ""} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={4} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 rounded-md text-sm">ยกเลิก</button>
              <button onClick={save} disabled={saving || !form.name || !form.content} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Guardrails section ───────────────────────────────────────────────────────

function GuardrailsSection() {
  const [items, setItems] = useState<Guardrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Guardrail> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

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

  if (loading) return <div className="h-12 animate-pulse bg-slate-100 rounded" />;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setForm({ type: "blocked_topic", isActive: true })}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-300 text-slate-500 rounded-md text-sm hover:border-blue-400 hover:text-blue-600 w-full justify-center"
      >
        <Plus className="h-3.5 w-3.5" /> เพิ่ม Guardrail
      </button>

      <div className="space-y-2">
        {items.map((item) => {
          const typeLabel = GUARDRAIL_TYPES.find((t) => t.value === item.type)?.label ?? item.type;
          return (
            <div key={item.id} className={`border rounded-lg p-3 flex items-center gap-2 ${item.isActive ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
              <button onClick={() => toggle(item)} className={item.isActive ? "text-blue-600" : "text-slate-300"}>
                {item.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{typeLabel}</span>
                  <span className="text-sm text-slate-700 truncate">{item.description}</span>
                </div>
                {item.value && <p className="text-xs text-slate-400 mt-0.5">{item.value}</p>}
              </div>
              <button onClick={() => remove(item.id)} className="p-1 text-slate-400 hover:text-red-500 shrink-0">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-center text-xs text-slate-400 py-4">ยังไม่มี Guardrail</p>}
      </div>

      {form !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">เพิ่ม Guardrail</h3>
              <button onClick={() => setForm(null)}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">ประเภท</label>
              <select value={form.type ?? "blocked_topic"} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm">
                {GUARDRAIL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">คำอธิบาย *</label>
              <input value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">ค่า (optional)</label>
              <input value={form.value ?? ""} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 rounded-md text-sm">ยกเลิก</button>
              <button onClick={save} disabled={saving || !form.description} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BotPromptTab() {
  const [open, setOpen] = useState<Record<string, boolean>>({
    prompt: true,
    faqs: false,
    templates: false,
    guardrails: false,
  });

  function toggle(key: string) {
    setOpen((o) => ({ ...o, [key]: !o[key] }));
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold text-slate-800">Bot Prompt & ความรู้</h2>
        <p className="text-sm text-slate-500">
          System Prompt, FAQ, Template ตอบกลับ และ Guardrails ทั้งหมดในที่เดียว
        </p>
      </div>

      <Section
        title="System Prompt"
        subtitle="Prompt หลักที่ Bot ใช้ทุก request — Auto-save + Publish เพื่อ activate"
        open={open.prompt}
        onToggle={() => toggle("prompt")}
      >
        <SystemPromptSection />
      </Section>

      <Section
        title="คำถามที่พบบ่อย (FAQs)"
        subtitle="ฐานความรู้และคำถาม-ตอบสำหรับ Bot"
        open={open.faqs}
        onToggle={() => toggle("faqs")}
      >
        <FaqsSection />
      </Section>

      <Section
        title="Response Templates"
        subtitle="ข้อความสำเร็จรูปที่ Bot ใช้ตามเงื่อนไข"
        open={open.templates}
        onToggle={() => toggle("templates")}
      >
        <TemplatesSection />
      </Section>

      <Section
        title="Guardrails & กฎสำคัญ"
        subtitle="สิ่งที่ Bot ห้ามพูดถึง หรือต้องปฏิบัติตามเสมอ"
        open={open.guardrails}
        onToggle={() => toggle("guardrails")}
      >
        <GuardrailsSection />
      </Section>
    </div>
  );
}
