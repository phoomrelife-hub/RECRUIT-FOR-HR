"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Save } from "lucide-react";

interface Persona {
  id?: string;
  botName: string;
  tone: string;
  language: string;
  greeting: string;
  signature: string;
}

const TONES = ["professional", "friendly", "formal", "casual", "warm"];
const LANGUAGES = [
  { value: "thai_english", label: "ไทย + English" },
  { value: "thai", label: "ภาษาไทยเท่านั้น" },
  { value: "english", label: "English only" },
];

export function PersonaTab() {
  const [persona, setPersona] = useState<Persona>({
    botName: "Daniel",
    tone: "professional",
    language: "thai_english",
    greeting: "",
    signature: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/ai/persona")
      .then((r) => r.json())
      .then((data) => {
        if (data) setPersona({ botName: data.botName ?? "Daniel", tone: data.tone ?? "professional", language: data.language ?? "thai_english", greeting: data.greeting ?? "", signature: data.signature ?? "" });
      })
      .finally(() => setLoading(false));
  }, []);

  const update = useCallback((key: keyof Persona, value: string) => {
    setPersona((p) => ({ ...p, [key]: value }));
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/settings/ai/persona", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(persona),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setSaving(false);
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-semibold text-slate-800">Bot Persona</h2>
        <p className="text-sm text-slate-500">กำหนดบุคลิกและชื่อของ AI Bot</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <Field label="Bot Name" hint="ชื่อที่ bot จะแนะนำตัว">
          <input
            value={persona.botName}
            onChange={(e) => update("botName", e.target.value)}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
            placeholder="Daniel"
          />
        </Field>

        <Field label="Tone" hint="โทนการสื่อสาร">
          <div className="flex gap-2 flex-wrap">
            {TONES.map((t) => (
              <button
                key={t}
                onClick={() => update("tone", t)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  persona.tone === t
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-200 text-slate-600 hover:border-blue-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Language" hint="ภาษาที่ bot ใช้ตอบ">
          <select
            value={persona.language}
            onChange={(e) => update("language", e.target.value)}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
          >
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </Field>

        <Field label="Greeting Message" hint="ข้อความทักทายเมื่อ candidate เริ่มต้นบทสนทนา">
          <textarea
            value={persona.greeting}
            onChange={(e) => update("greeting", e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none"
            placeholder="สวัสดีค่ะ! ฉันคือ Daniel ผู้ช่วย HR ของ Relife..."
          />
        </Field>

        <Field label="Signature" hint="ลายเซ็นท้ายข้อความ (ถ้ามี)">
          <input
            value={persona.signature}
            onChange={(e) => update("signature", e.target.value)}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
            placeholder="— Daniel | Relife HR Team"
          />
        </Field>
      </div>

      {/* Preview */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="text-xs text-slate-500 mb-2 font-medium">Preview</div>
        <div className="bg-white rounded-lg p-3 text-sm text-slate-700 border border-slate-100">
          {persona.greeting || `สวัสดีค่ะ ฉันคือ ${persona.botName} ผู้ช่วย HR ของ Relife`}
          {persona.signature && <div className="mt-1 text-slate-400 text-xs">{persona.signature}</div>}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saved ? "Saved!" : "Save Persona"}
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}
