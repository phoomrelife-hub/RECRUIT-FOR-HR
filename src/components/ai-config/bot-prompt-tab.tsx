"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Save, History, Loader2, Check, Zap, Eye, EyeOff } from "lucide-react";

const SECTIONS = [
  {
    key: "objectives",
    thLabel: "เป้าหมายหลัก",
    enLabel: "Primary Objectives",
    placeholder: "ระบุเป้าหมายหลักของ bot เช่น คัดกรองผู้สมัคร, ให้ข้อมูลตำแหน่งงาน, นัดสัมภาษณ์...",
    rows: 6,
  },
  {
    key: "company_info",
    thLabel: "ข้อมูลบริษัท",
    enLabel: "Company Info",
    placeholder: "แนะนำบริษัท ประวัติ วัฒนธรรมองค์กร สวัสดิการ...",
    rows: 6,
  },
  {
    key: "conversation_flow",
    thLabel: "ลำดับการสนทนา",
    enLabel: "Conversation Flow",
    placeholder: "ขั้นตอนการพูดคุยกับผู้สมัคร เช่น 1) ทักทาย 2) ถามชื่อ 3) ถามตำแหน่ง...",
    rows: 8,
  },
  {
    key: "response_guidelines",
    thLabel: "แนวทางการตอบ",
    enLabel: "Response Guidelines",
    placeholder: "วิธีการตอบคำถาม น้ำเสียง สไตล์การสื่อสาร ความเป็นทางการ...",
    rows: 6,
  },
  {
    key: "faqs",
    thLabel: "คำถามที่พบบ่อย",
    enLabel: "FAQs",
    placeholder: "Q: เงินเดือนเท่าไหร่?\nA: ...\n\nQ: ทำงานกี่วัน?\nA: ...",
    rows: 10,
  },
  {
    key: "critical_rules",
    thLabel: "กฎสำคัญ",
    enLabel: "Critical Rules",
    placeholder: "สิ่งที่ bot ห้ามทำหรือต้องทำเสมอ เช่น ห้ามเปิดเผยข้อมูลเงินเดือนก่อนได้รับอนุญาต...",
    rows: 6,
  },
  {
    key: "position_info",
    thLabel: "ข้อมูลตำแหน่งงาน",
    enLabel: "Position Info",
    placeholder: "ตำแหน่งที่เปิดรับ คุณสมบัติ หน้าที่ความรับผิดชอบ...",
    rows: 8,
  },
  {
    key: "contact_info",
    thLabel: "ข้อมูลติดต่อ",
    enLabel: "Contact Info",
    placeholder: "เบอร์โทร อีเมล Line ID ที่อยู่สำนักงาน...",
    rows: 4,
  },
  {
    key: "response_templates",
    thLabel: "Template การตอบ",
    enLabel: "Response Templates",
    placeholder: "รูปแบบข้อความสำเร็จรูป เช่น ข้อความต้อนรับ, แจ้งผลการสมัคร, นัดสัมภาษณ์...",
    rows: 8,
  },
  {
    key: "custom_instructions",
    thLabel: "คำสั่งเพิ่มเติม",
    enLabel: "Custom Instructions",
    placeholder: "คำสั่งพิเศษเพิ่มเติมนอกเหนือจากหมวดอื่น...",
    rows: 6,
  },
];

const CONTENT_KEYS = SECTIONS.map((s) => s.key);

const PROVIDERS = [
  {
    value: "qwen",
    label: "Qwen (DashScope)",
    defaultModel: "qwen-plus",
    hint: "dashscope-intl.aliyuncs.com · ฟรีสำหรับ tier แรก",
    models: ["qwen-plus", "qwen-turbo", "qwen-max", "qwen2.5-72b-instruct", "qwen2.5-7b-instruct"],
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    defaultModel: "openai/gpt-4o-mini",
    hint: "openrouter.ai · รองรับ 300+ models รวมถึง free models",
    models: ["openai/gpt-4o-mini", "openai/gpt-4o", "anthropic/claude-3-haiku", "google/gemini-flash-1.5", "meta-llama/llama-3.1-8b-instruct:free", "mistralai/mistral-7b-instruct:free"],
  },
  {
    value: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    hint: "api.openai.com · ต้องมี billing",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  },
  {
    value: "groq",
    label: "Groq",
    defaultModel: "llama-3.1-8b-instant",
    hint: "api.groq.com · เร็วมาก, มี free tier",
    models: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "llama3-8b-8192", "mixtral-8x7b-32768", "gemma2-9b-it"],
  },
  {
    value: "together",
    label: "Together AI",
    defaultModel: "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
    hint: "api.together.xyz · open-source models ราคาถูก",
    models: ["meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "mistralai/Mistral-7B-Instruct-v0.3", "Qwen/Qwen2.5-7B-Instruct-Turbo"],
  },
  {
    value: "mistral",
    label: "Mistral AI",
    defaultModel: "mistral-small-latest",
    hint: "api.mistral.ai · European AI, ราคาประหยัด",
    models: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest", "open-mistral-7b", "open-mixtral-8x7b"],
  },
  {
    value: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.0-flash",
    hint: "generativelanguage.googleapis.com · มี free tier",
    models: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"],
  },
];

export function BotPromptTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; reply?: string; error?: string } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [hasError, setHasError] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [provider, setProvider] = useState("qwen");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = useRef(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/ai/bot-prompt");
      if (res.ok) {
        const data = await res.json();
        const vals: Record<string, string> = {};
        for (const key of CONTENT_KEYS) vals[key] = data[key] ?? "";
        setValues(vals);
        setActive(data.active !== "false");
        setProvider(data.provider_name ?? "qwen");
        setModel(data.provider_model ?? "");
        setApiKey(data.provider_api_key ?? "");
      }
    } catch {
      setHasError(true);
    }
    setLoading(false);
  }

  function buildPayload(vals = values, isActive = active, prov = provider, mod = model, key = apiKey) {
    return { ...vals, active: isActive ? "true" : "false", provider_name: prov, provider_model: mod, provider_api_key: key };
  }

  async function save(payload = buildPayload()) {
    setSaving(true);
    setHasError(false);
    try {
      const res = await fetch("/api/settings/ai/bot-prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setSavedAt(new Date());
      isDirty.current = false;
    } catch {
      setHasError(true);
    }
    setSaving(false);
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    await save(buildPayload());
    try {
      const res = await fetch("/api/settings/ai/test-kimi");
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "Network error" });
    }
    setTesting(false);
  }

  function handleChange(key: string, val: string) {
    const next = { ...values, [key]: val };
    setValues(next);
    isDirty.current = true;
    if (autoSave) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => save(buildPayload(next)), 2000);
    }
  }

  function handleActiveToggle(checked: boolean) {
    setActive(checked);
    if (autoSave) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => save(buildPayload(values, checked)), 2000);
    }
  }

  function handleProviderChange(val: string) {
    const p = PROVIDERS.find((x) => x.value === val);
    setProvider(val);
    if (!model) setModel(p?.defaultModel ?? "");
  }

  const currentProvider = PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0];
  const filledCount = CONTENT_KEYS.filter((k) => (values[k] ?? "").trim().length > 0).length;
  const totalChars = CONTENT_KEYS.reduce((sum, k) => sum + (values[k] ?? "").length, 0);

  if (loading) return <div className="animate-pulse h-96 bg-slate-100 rounded-xl" />;

  return (
    <div>
      {/* AI Provider card */}
      <div className="border border-slate-200 rounded-xl p-5 mb-5 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-slate-800 text-sm">AI Provider</span>
        </div>
        <div className="space-y-4">
          {/* Row 1: Provider + Model */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Provider dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Provider</label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400">{currentProvider.hint}</p>
            </div>

            {/* Model input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Model</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={currentProvider.defaultModel}
                list={`model-list-${provider}`}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id={`model-list-${provider}`}>
                {currentProvider.models.map((m) => <option key={m} value={m} />)}
              </datalist>
              <p className="text-xs text-slate-400">พิมพ์ชื่อ model เองได้ หรือเลือกจากรายการ</p>
            </div>
          </div>

          {/* Row 2: API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">API Key</label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-9 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setShowApiKey((v) => !v)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={testConnection}
                disabled={testing || !apiKey}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
              >
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-blue-500" />}
                ทดสอบ
              </button>
            </div>
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm ${testResult.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {testResult.ok ? `✓ ใช้งานได้ — "${testResult.reply}"` : `✗ ${testResult.error}`}
          </div>
        )}
      </div>

      {/* Header bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-sm">
            <button onClick={() => setOpenKeys(new Set(CONTENT_KEYS))} className="text-blue-600 hover:underline font-medium">
              เปิดทั้งหมด
            </button>
            <span className="text-slate-300 mx-0.5">/</span>
            <button onClick={() => setOpenKeys(new Set())} className="text-blue-600 hover:underline font-medium">
              ปิดทั้งหมด
            </button>
          </div>
          <span className="text-sm text-slate-500">{filledCount}/{SECTIONS.length} หมวดที่กรอกแล้ว</span>
          {hasError && (
            <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
              Error
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
            <button
              role="switch"
              aria-checked={autoSave}
              onClick={() => setAutoSave((v) => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors ${autoSave ? "bg-blue-500" : "bg-slate-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${autoSave ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            Auto-save
          </label>

          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
            <button
              role="switch"
              aria-checked={active}
              onClick={() => handleActiveToggle(!active)}
              className={`relative w-9 h-5 rounded-full transition-colors ${active ? "bg-green-500" : "bg-slate-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            Active
          </label>

          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50">
            <History className="h-3.5 w-3.5" />
            History
          </button>

          <button
            onClick={() => save()}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-60 font-medium min-w-[90px] justify-center"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedAt && !isDirty.current ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            บันทึก
          </button>
        </div>
      </div>

      {savedAt && !saving && (
        <p className="text-xs text-slate-400 text-right mb-3">
          บันทึกล่าสุด {savedAt.toLocaleTimeString("th-TH")}
        </p>
      )}

      {/* Accordion sections */}
      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
        {SECTIONS.map((section) => {
          const isOpen = openKeys.has(section.key);
          const content = values[section.key] ?? "";
          const isFilled = content.trim().length > 0;

          return (
            <div key={section.key}>
              <button
                onClick={() => setOpenKeys((prev) => { const n = new Set(prev); n.has(section.key) ? n.delete(section.key) : n.add(section.key); return n; })}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left bg-white"
              >
                <div className="flex items-center gap-3">
                  <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`} />
                  <span className="font-medium text-slate-800 text-sm">{section.thLabel}</span>
                  <span className="text-sm text-slate-400">({section.enLabel})</span>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${isFilled ? "bg-green-500" : "bg-slate-300"}`} />
                </div>
                <span className="text-sm text-slate-400 tabular-nums shrink-0 ml-4">
                  {content.length.toLocaleString()} ตัวอักษร
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100">
                  <div className="pt-4">
                    <textarea
                      value={content}
                      onChange={(e) => handleChange(section.key, e.target.value)}
                      rows={section.rows}
                      placeholder={section.placeholder}
                      className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 bg-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer total */}
      <div className="flex items-center justify-between pt-4 mt-1 border-t border-slate-200">
        <span className="text-sm text-slate-500">จำนวนตัวอักษรรวมทั้งหมด</span>
        <span className="text-sm font-semibold text-slate-700 tabular-nums">
          {totalChars.toLocaleString()} ตัวอักษร
        </span>
      </div>
    </div>
  );
}
