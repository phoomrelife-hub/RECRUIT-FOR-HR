"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, Save } from "lucide-react";

const ARCHETYPES = [
  { value: "professional", emoji: "🎯", label: "มืออาชีพ", desc: "Professional" },
  { value: "friendly", emoji: "😊", label: "เป็นกันเอง", desc: "Friendly" },
  { value: "formal", emoji: "💼", label: "ทางการ", desc: "Formal" },
  { value: "enthusiastic", emoji: "🌟", label: "กระตือรือร้น", desc: "Enthusiastic" },
  { value: "trustworthy", emoji: "🤝", label: "น่าเชื่อถือ", desc: "Trustworthy" },
  { value: "smart", emoji: "💡", label: "ฉลาดเฉลียว", desc: "Smart" },
  { value: "warm", emoji: "❤️", label: "อบอุ่น", desc: "Warm" },
  { value: "modern", emoji: "🚀", label: "ทันสมัย", desc: "Modern" },
];

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "fun", label: "Fun" },
  { value: "luxury", label: "Luxury" },
  { value: "caring", label: "Caring" },
  { value: "smart", label: "Smart" },
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "energetic", label: "Energetic" },
];

const LANGUAGES = [
  { value: "thai_english", label: "ไทย + English" },
  { value: "thai", label: "ภาษาไทยเท่านั้น" },
  { value: "english", label: "English only" },
];

interface PersonaData {
  botName: string;
  archetype: string;
  tone: string;
  language: string;
  greeting: string;
  signature: string;
}

export function PersonaTab() {
  const [data, setData] = useState<PersonaData>({
    botName: "Daniel",
    archetype: "professional",
    tone: "professional",
    language: "thai_english",
    greeting: "",
    signature: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const [personaRes, settingRes] = await Promise.all([
        fetch("/api/settings/ai/persona"),
        fetch("/api/settings/ai/bot-prompt"),
      ]);
      const persona = personaRes.ok ? await personaRes.json() : {};
      const setting = settingRes.ok ? await settingRes.json() : {};
      setData({
        botName: persona.botName ?? "Daniel",
        archetype: setting.persona_archetype ?? "professional",
        tone: persona.tone ?? "professional",
        language: persona.language ?? "thai_english",
        greeting: persona.greeting ?? "",
        signature: persona.signature ?? "",
      });
      setLoading(false);
    }
    load();
  }, []);

  function update<K extends keyof PersonaData>(key: K, value: PersonaData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setSaving(true);
    await Promise.all([
      fetch("/api/settings/ai/persona", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botName: data.botName,
          tone: data.tone,
          language: data.language,
          greeting: data.greeting,
          signature: data.signature,
        }),
      }),
      fetch("/api/settings/ai/bot-prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona_archetype: data.archetype }),
      }),
    ]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setSaving(false);
  }

  if (loading) return <div className="animate-pulse h-96 bg-slate-100 rounded-xl" />;

  const selectedArchetype = ARCHETYPES.find((a) => a.value === data.archetype);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Bot name */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-800">ชื่อ Bot</label>
          <p className="text-xs text-slate-400 mt-0.5">ชื่อที่ bot จะแนะนำตัวกับผู้สมัคร</p>
        </div>
        <input
          value={data.botName}
          onChange={(e) => update("botName", e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Daniel"
        />
      </div>

      {/* Archetype selection */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-800">บุคลิกหลัก</label>
          <p className="text-xs text-slate-400 mt-0.5">เลือกบุคลิกที่ bot จะแสดงออก</p>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {ARCHETYPES.map((a) => (
            <button
              key={a.value}
              onClick={() => update("archetype", a.value)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                data.archetype === a.value
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-slate-100 hover:border-slate-300 bg-white"
              }`}
            >
              <span className="text-2xl">{a.emoji}</span>
              <span className={`text-xs font-medium leading-tight text-center ${data.archetype === a.value ? "text-blue-700" : "text-slate-700"}`}>
                {a.label}
              </span>
              <span className="text-[10px] text-slate-400">{a.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tone */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-800">โทนเสียง</label>
          <p className="text-xs text-slate-400 mt-0.5">สไตล์การสื่อสารของ bot</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => update("tone", t.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                data.tone === t.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Language + Greeting */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <label className="text-sm font-semibold text-slate-800">ภาษาที่ใช้</label>
        <div className="flex gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              onClick={() => update("language", l.value)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm border-2 transition-all font-medium ${
                data.language === l.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <label className="text-sm font-medium text-slate-700">ข้อความทักทาย</label>
          <p className="text-xs text-slate-400">ข้อความแรกที่ bot จะส่งเมื่อเริ่มบทสนทนา</p>
          <textarea
            value={data.greeting}
            onChange={(e) => update("greeting", e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={`สวัสดีครับ ผมชื่อ ${data.botName} ผู้ช่วย HR ของ Relife ครับ 😊`}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Signature</label>
          <input
            value={data.signature}
            onChange={(e) => update("signature", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={`— ${data.botName} | Relife HR Team`}
          />
        </div>
      </div>

      {/* Preview */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="text-xs font-medium text-slate-500 mb-3 flex items-center gap-2">
          <span>Preview</span>
          {selectedArchetype && (
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px]">
              {selectedArchetype.emoji} {selectedArchetype.label}
            </span>
          )}
        </div>
        <div className="flex items-start gap-2.5">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {data.botName.charAt(0).toUpperCase()}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-700 max-w-xs shadow-sm">
            {data.greeting || `สวัสดีครับ ผมชื่อ ${data.botName} ผู้ช่วย HR ของ Relife ครับ 😊`}
            {data.signature && (
              <div className="mt-1.5 text-xs text-slate-400 border-t border-slate-100 pt-1.5">{data.signature}</div>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <Check className="h-4 w-4" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saved ? "บันทึกแล้ว!" : "บันทึก"}
      </button>
    </div>
  );
}
