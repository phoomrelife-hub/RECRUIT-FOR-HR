"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Save,
  Loader2,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
  FileText,
  LayoutGrid,
  Download,
  Upload,
  Clock,
} from "lucide-react";

const SECTIONS = [
  {
    key: "objectives",
    thLabel: "เป้าหมายหลัก",
    enLabel: "Objectives",
    placeholder: "บอทมีเป้าหมายเพื่อ... เช่น คัดกรองผู้สมัคร ให้ข้อมูลตำแหน่ง นัดสัมภาษณ์...",
    rows: 5,
  },
  {
    key: "identity",
    thLabel: "ตัวตนและน้ำเสียง",
    enLabel: "Identity / Voice",
    placeholder: "ชื่อบอท, น้ำเสียง, การลงท้าย, สิ่งที่ห้ามทำ...",
    rows: 8,
  },
  {
    key: "critical_rules",
    thLabel: "กฎสำคัญ",
    enLabel: "Critical Rules",
    placeholder: "กฎที่บอทต้องปฏิบัติเสมอ เช่น ห้าม re-greet, ลิงก์ฟอร์มที่ใช้...",
    rows: 8,
  },
  {
    key: "conversation_flow",
    thLabel: "ลำดับการสนทนา",
    enLabel: "Conversation Flow",
    placeholder: "ขั้นตอน 1) ทักทาย 2) ถามชื่อ 3) ถามตำแหน่งที่สมัคร 4) ส่งลิงก์ฟอร์ม...",
    rows: 8,
  },
  {
    key: "positions",
    thLabel: "ข้อมูลตำแหน่งและบริษัท",
    enLabel: "Position & Company Info",
    placeholder: "ตำแหน่งที่เปิดรับ เงินเดือน คุณสมบัติ ที่อยู่บริษัท สวัสดิการ...",
    rows: 10,
  },
  {
    key: "contact",
    thLabel: "ข้อมูลติดต่อ",
    enLabel: "Contact Info",
    placeholder: "เบอร์โทร: 082-474-4442\nEmail: hr@relife.co.th\nLINE OA: @relifejob",
    rows: 4,
  },
  {
    key: "faqs",
    thLabel: "คำถามที่พบบ่อย",
    enLabel: "FAQs",
    placeholder: "Q: เงินเดือนเท่าไหร่?\nA: ...\n\nQ: ทำงานกี่วันต่อสัปดาห์?\nA: ...",
    rows: 8,
  },
  {
    key: "response_templates",
    thLabel: "Template การตอบ",
    enLabel: "Response Templates",
    placeholder: "ข้อความต้อนรับ: สวัสดีครับ...\nแจ้งผลสมัคร: ขอบคุณที่สมัครงาน...\nนัดสัมภาษณ์: ทางบริษัทขอนัดสัมภาษณ์...",
    rows: 8,
  },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];
type ContentValues = Record<SectionKey, string>;

const TONES = ["Professional", "Friendly", "Formal", "Casual", "Warm", "Enthusiastic"];
const LANGUAGES = [
  { value: "thai_english", label: "ไทย + English" },
  { value: "thai", label: "ภาษาไทย" },
  { value: "english", label: "English" },
];

const WORKSPACE_FILES = ["SOUL.md", "POSITIONS.md", "RULES.md", "EXAMPLES.md"] as const;
type WorkspaceFile = (typeof WORKSPACE_FILES)[number];

const CONFIG_URL = "https://recruit-for-hr.vercel.app/api/openclaw/config";

interface OpenClawConnection {
  ok: boolean;
  version?: string;
  error?: string;
}

interface OpenClawServerConfig {
  enabled: boolean;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
}

type ViewMode = "sections" | "files";

export function OpenClawRulesTab() {
  // ── Sections mode state ───────────────────────────────────────────────
  const [values, setValues] = useState<ContentValues>({
    objectives: "",
    identity: "",
    critical_rules: "",
    conversation_flow: "",
    positions: "",
    contact: "",
    faqs: "",
    response_templates: "",
  });
  const [botName, setBotName] = useState("หลิน");
  const [tone, setTone] = useState("Friendly");
  const [language, setLanguage] = useState("thai_english");
  const [active, setActive] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [serverConfig, setServerConfig] = useState<OpenClawServerConfig>({
    enabled: true,
    model: "default",
    temperature: 0.7,
    max_tokens: 500,
    system_prompt: "",
  });
  const [connection, setConnection] = useState<OpenClawConnection | null>(null);
  const [autoSave, setAutoSave] = useState(true);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEnabled, setSavingEnabled] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = useRef(false);

  // ── Raw Files mode state ──────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("sections");
  const [activeFile, setActiveFile] = useState<WorkspaceFile>("SOUL.md");
  const [fileContents, setFileContents] = useState<Record<WorkspaceFile, string>>({
    "SOUL.md": "",
    "POSITIONS.md": "",
    "RULES.md": "",
    "EXAMPLES.md": "",
  });
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesSaving, setFilesSaving] = useState(false);
  const [filesSavedAt, setFilesSavedAt] = useState<Date | null>(null);
  const [filesDirty, setFilesDirty] = useState(false);   // DB has pending changes not yet in bot
  const [filesError, setFilesError] = useState("");
  const [filePulled, setFilePulled] = useState(false);   // at least one successful pull

  useEffect(() => {
    load();
  }, []);

  // ── Load sections from DB ─────────────────────────────────────────────

  async function load() {
    setLoading(true);
    try {
      const [rulesRes, openclawRes] = await Promise.all([
        fetch("/api/settings/ai/openclaw-rules"),
        fetch("/api/settings/ai/openclaw"),
      ]);

      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setValues({
          objectives: data.objectives ?? "",
          identity: data.identity ?? "",
          critical_rules: data.critical_rules ?? "",
          conversation_flow: data.conversation_flow ?? "",
          positions: data.positions ?? "",
          contact: data.contact ?? "",
          faqs: data.faqs ?? "",
          response_templates: data.response_templates ?? "",
        });
        setActive(data.active === "true");
        setBotName(data.bot_name ?? "หลิน");
        setTone(data.tone ?? "Friendly");
        setLanguage(data.language ?? "thai_english");
      }

      if (openclawRes.ok) {
        const data = await openclawRes.json();
        const cfg = data.config ?? {};
        setEnabled(cfg.enabled !== false);
        setServerConfig({
          enabled: cfg.enabled !== false,
          model: cfg.model ?? "default",
          temperature: cfg.temperature ?? 0.7,
          max_tokens: cfg.max_tokens ?? 500,
          system_prompt: cfg.system_prompt ?? "",
        });
        setConnection(data.connection ?? null);
      }
    } catch {
      setHasError(true);
    }
    setLoading(false);
  }

  // ── Load raw files from DB (pushed by middleware.py on startup) ───────

  async function loadFiles(showLoading = true) {
    if (showLoading) setFilesLoading(true);
    setFilesError("");
    try {
      const res = await fetch("/api/openclaw/workspace");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const files = data.files as Record<string, string> | undefined;
      if (files && Object.keys(files).length > 0) {
        setFileContents((prev) => ({
          ...prev,
          ...Object.fromEntries(
            WORKSPACE_FILES.filter((f) => files[f] !== undefined).map((f) => [f, files[f] ?? ""])
          ),
        }));
        setFilePulled(true);
        setFilesDirty(!!data.dirty);
      } else {
        setFilesError("ยังไม่มีข้อมูล — รอ middleware.py push ขึ้นมา (จะเกิดขึ้นอัตโนมัติเมื่อ restart middleware)");
      }
    } catch (e) {
      setFilesError(`โหลดไม่สำเร็จ: ${e}`);
    }
    if (showLoading) setFilesLoading(false);
  }

  // ── Save raw files to DB + set dirty flag for middleware.py ──────────

  async function saveFiles() {
    setFilesSaving(true);
    setFilesError("");
    try {
      const res = await fetch("/api/openclaw/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: fileContents }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFilesSavedAt(new Date());
      setFilesDirty(true); // middleware.py hasn't pulled yet
    } catch (e) {
      setFilesError(`บันทึกไม่สำเร็จ: ${e}`);
    }
    setFilesSaving(false);
  }

  // ── Sections mode handlers ────────────────────────────────────────────

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/settings/ai/openclaw");
      if (res.ok) {
        const data = await res.json();
        setConnection(data.connection ?? null);
      }
    } finally {
      setTesting(false);
    }
  }

  async function toggleEnabled(val: boolean) {
    setSavingEnabled(true);
    setEnabled(val);
    try {
      await fetch("/api/settings/ai/openclaw", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...serverConfig, enabled: val }),
      });
      setServerConfig((prev) => ({ ...prev, enabled: val }));
    } finally {
      setSavingEnabled(false);
    }
  }

  function buildPayload(
    vals = values,
    isActive = active,
    name = botName,
    t = tone,
    lang = language
  ) {
    return { ...vals, active: isActive, bot_name: name, tone: t, language: lang };
  }

  async function save(payload = buildPayload()) {
    setSaving(true);
    setHasError(false);
    try {
      const res = await fetch("/api/settings/ai/openclaw-rules", {
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

  function scheduleAutoSave(payload: ReturnType<typeof buildPayload>) {
    isDirty.current = true;
    if (!autoSave) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => save(payload), 2000);
  }

  function handleChange(key: SectionKey, val: string) {
    const next = { ...values, [key]: val };
    setValues(next);
    scheduleAutoSave(buildPayload(next));
  }

  function handleBotName(val: string) {
    setBotName(val);
    scheduleAutoSave(buildPayload(values, active, val, tone, language));
  }

  function handleTone(val: string) {
    setTone(val);
    scheduleAutoSave(buildPayload(values, active, botName, val, language));
  }

  function handleLanguage(val: string) {
    setLanguage(val);
    scheduleAutoSave(buildPayload(values, active, botName, tone, val));
  }

  function handleActiveToggle(checked: boolean) {
    setActive(checked);
    scheduleAutoSave(buildPayload(values, checked));
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(CONFIG_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filledCount = SECTIONS.filter((s) => (values[s.key] ?? "").trim().length > 0).length;
  const totalChars = SECTIONS.reduce((sum, s) => sum + (values[s.key] ?? "").length, 0);

  if (loading) return <div className="animate-pulse h-96 bg-slate-100 rounded-xl" />;

  return (
    <div>
      {/* Connection status + OpenClaw enable toggle */}
      <div className="border border-slate-200 rounded-xl p-4 mb-5 bg-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {connection?.ok ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                <CheckCircle className="h-3.5 w-3.5" />
                เชื่อมต่อแล้ว{connection.version ? ` · v${connection.version}` : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
                <XCircle className="h-3.5 w-3.5" />
                ไม่ได้เชื่อมต่อ
              </span>
            )}
            <button
              onClick={testConnection}
              disabled={testing}
              className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
              ทดสอบ
            </button>
            {!connection?.ok && connection?.error && (
              <span className="text-xs text-slate-400">{connection.error}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">เปิดใช้งาน OpenClaw</span>
            {savingEnabled && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
            <button
              role="switch"
              aria-checked={enabled}
              onClick={() => toggleEnabled(!enabled)}
              disabled={savingEnabled}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-60 ${
                enabled ? "bg-blue-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* View mode switcher */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 mb-5 w-fit">
        <button
          onClick={() => setViewMode("sections")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === "sections"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Sections
        </button>
        <button
          onClick={() => {
            setViewMode("files");
            if (!filePulled) loadFiles();
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === "files"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Raw Files
          {filesDirty && (
            <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" title="มีการเปลี่ยนแปลงที่ยังรอส่งไปบอท" />
          )}
        </button>
      </div>

      {/* ─── SECTIONS MODE ────────────────────────────────────────────────── */}
      {viewMode === "sections" && (
        <>
          {/* Bot basics */}
          <div className="border border-slate-200 rounded-xl p-5 mb-5 bg-white">
            <p className="text-sm font-semibold text-slate-800 mb-4">ข้อมูลบอท</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">ชื่อบอท</label>
                <input
                  value={botName}
                  onChange={(e) => handleBotName(e.target.value)}
                  placeholder="หลิน"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">โทนเสียง</label>
                <select
                  value={tone}
                  onChange={(e) => handleTone(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">ภาษา</label>
                <select
                  value={language}
                  onChange={(e) => handleLanguage(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-sm">
                <button
                  onClick={() => setOpenKeys(new Set(SECTIONS.map((s) => s.key)))}
                  className="text-blue-600 hover:underline font-medium"
                >
                  เปิดทั้งหมด
                </button>
                <span className="text-slate-300 mx-0.5">/</span>
                <button
                  onClick={() => setOpenKeys(new Set())}
                  className="text-blue-600 hover:underline font-medium"
                >
                  ปิดทั้งหมด
                </button>
              </div>
              <span className="text-sm text-slate-500">
                {filledCount}/{SECTIONS.length} หมวดที่กรอกแล้ว
              </span>
              {hasError && (
                <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                  บันทึกไม่สำเร็จ
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Send to OpenClaw toggle */}
              <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
                <button
                  role="switch"
                  aria-checked={active}
                  onClick={() => handleActiveToggle(!active)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    active ? "bg-green-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      active ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                ส่งไป OpenClaw
              </label>

              {/* Auto-save toggle */}
              <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
                <button
                  role="switch"
                  aria-checked={autoSave}
                  onClick={() => setAutoSave((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    autoSave ? "bg-blue-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      autoSave ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                Auto-save
              </label>

              <button
                onClick={() => save()}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-60 font-medium min-w-[90px] justify-center"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : savedAt && !isDirty.current ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
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
                    onClick={() =>
                      setOpenKeys((prev) => {
                        const n = new Set(prev);
                        n.has(section.key) ? n.delete(section.key) : n.add(section.key);
                        return n;
                      })
                    }
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronRight
                        className={`h-4 w-4 text-slate-400 transition-transform shrink-0 ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      />
                      <span className="font-medium text-slate-800 text-sm">{section.thLabel}</span>
                      <span className="text-sm text-slate-400">({section.enLabel})</span>
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isFilled ? "bg-green-500" : "bg-slate-300"
                        }`}
                      />
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

          {/* Export URL */}
          <div className="border border-slate-200 rounded-xl p-5 mt-5 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-slate-800 text-sm">Export URL (สำหรับ OpenClaw)</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              ให้ OpenClaw เรียก URL นี้เพื่อดึง system prompt ล่าสุดจาก DB
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={CONFIG_URL}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-600 bg-slate-50 focus:outline-none"
              />
              <button
                onClick={copyUrl}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors whitespace-nowrap ${
                  copied
                    ? "border-green-300 text-green-700 bg-green-50"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "คัดลอกแล้ว" : "คัดลอก"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── RAW FILES MODE ───────────────────────────────────────────────── */}
      {viewMode === "files" && (
        <div>
          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
            <FileText className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-0.5">แก้ไขไฟล์ workspace-hr โดยตรง</p>
              <p className="text-xs text-blue-600">
                middleware.py จะ push ไฟล์ขึ้นมาอัตโนมัติเมื่อ restart · เมื่อบันทึกจากหน้านี้ middleware.py จะดึงไปเขียนใหม่ภายใน 5 นาที
              </p>
            </div>
          </div>

          {/* Pending changes badge */}
          {filesDirty && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">
                <span className="font-medium">รอ middleware.py ดึงไป</span> — ไฟล์ใน DB ล่าสุดกว่าไฟล์ในบอท
                (middleware.py จะ sync ภายใน 5 นาที)
              </p>
            </div>
          )}

          {/* File tabs + toolbar */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-1">
              {WORKSPACE_FILES.map((fname) => {
                const chars = fileContents[fname]?.length ?? 0;
                return (
                  <button
                    key={fname}
                    onClick={() => setActiveFile(fname)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors font-mono ${
                      activeFile === fname
                        ? "bg-slate-800 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {fname}
                    {chars > 0 && (
                      <span className={`text-xs tabular-nums ${activeFile === fname ? "text-slate-300" : "text-slate-400"}`}>
                        {chars.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {filesError && (
                <span className="text-xs text-red-500 font-medium">{filesError}</span>
              )}
              <button
                onClick={() => loadFiles()}
                disabled={filesLoading}
                className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <Download className={`h-3.5 w-3.5 ${filesLoading ? "animate-bounce" : ""}`} />
                {filesLoading ? "กำลังดึง..." : "↓ Pull จากบอท"}
              </button>
              <button
                onClick={saveFiles}
                disabled={filesSaving || !filePulled}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-60 font-medium min-w-[130px] justify-center"
              >
                {filesSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : filesSavedAt ? (
                  <Upload className="h-3.5 w-3.5" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                ↑ บันทึก & Push
              </button>
            </div>
          </div>

          {filesSavedAt && !filesSaving && (
            <p className="text-xs text-slate-400 text-right mb-2">
              บันทึกแล้วเมื่อ {filesSavedAt.toLocaleTimeString("th-TH")} · middleware.py จะ sync ภายใน 5 นาที
            </p>
          )}

          {/* File editor */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            {/* File name bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border-b border-slate-700">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-xs text-slate-300 font-mono ml-2">
                /workspace-hr/{activeFile}
              </span>
            </div>

            {filesLoading ? (
              <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                กำลังโหลด...
              </div>
            ) : !filePulled ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-sm gap-3">
                <FileText className="h-8 w-8 text-slate-300" />
                <p>กด &quot;↓ Pull จากบอท&quot; เพื่อโหลดเนื้อหาไฟล์</p>
                <p className="text-xs text-slate-300">
                  ต้องการให้ middleware.py รันและ push ขึ้นมาก่อน
                </p>
              </div>
            ) : (
              <textarea
                value={fileContents[activeFile]}
                onChange={(e) =>
                  setFileContents((prev) => ({ ...prev, [activeFile]: e.target.value }))
                }
                rows={30}
                spellCheck={false}
                className="w-full px-5 py-4 text-sm font-mono text-slate-700 bg-white resize-y focus:outline-none leading-relaxed"
                style={{ minHeight: "500px" }}
              />
            )}
          </div>

          {/* Sync status footer */}
          <div className="flex items-center justify-between pt-4 mt-1 text-xs text-slate-400">
            <span>การเปลี่ยนแปลงจะมีผลกับบอทภายใน 5 นาที (middleware.py poll ทุก 5 นาที)</span>
            <span className="font-mono">
              {fileContents[activeFile]?.length.toLocaleString() ?? 0} chars · {activeFile}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
