"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Save, Loader2, Check, Copy, ExternalLink } from "lucide-react";

const SECTIONS = [
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
    key: "positions",
    thLabel: "ข้อมูลตำแหน่งงานและบริษัท",
    enLabel: "Position & Company Info",
    placeholder:
      "ตำแหน่งที่เปิดรับ เงินเดือน คุณสมบัติ ที่อยู่บริษัท สวัสดิการ...",
    rows: 10,
  },
  {
    key: "contact",
    thLabel: "ข้อมูลติดต่อ",
    enLabel: "Contact Info",
    placeholder: "เบอร์โทร: 082-474-4442, Email: hr@relife.co.th, LINE OA: @relifejob",
    rows: 4,
  },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];
type Values = Record<SectionKey, string>;

const CONFIG_URL = "https://recruit-for-hr.vercel.app/api/openclaw/config";

export function OpenClawRulesTab() {
  const [values, setValues] = useState<Values>({
    identity: "",
    critical_rules: "",
    positions: "",
    contact: "",
  });
  const [active, setActive] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = useRef(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/ai/openclaw-rules");
      if (res.ok) {
        const data = await res.json();
        setValues({
          identity: data.identity ?? "",
          critical_rules: data.critical_rules ?? "",
          positions: data.positions ?? "",
          contact: data.contact ?? "",
        });
        setActive(data.active === "true");
      }
    } catch {
      setHasError(true);
    }
    setLoading(false);
  }

  function buildPayload(
    vals = values,
    isActive = active
  ): Values & { active: boolean } {
    return { ...vals, active: isActive };
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

  function handleChange(key: SectionKey, val: string) {
    const next = { ...values, [key]: val };
    setValues(next);
    isDirty.current = true;
    if (autoSave) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(
        () => save(buildPayload(next, active)),
        2000
      );
    }
  }

  function handleActiveToggle(checked: boolean) {
    setActive(checked);
    isDirty.current = true;
    if (autoSave) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(
        () => save(buildPayload(values, checked)),
        2000
      );
    }
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(CONFIG_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filledCount = SECTIONS.filter(
    (s) => (values[s.key] ?? "").trim().length > 0
  ).length;
  const totalChars = SECTIONS.reduce(
    (sum, s) => sum + (values[s.key] ?? "").length,
    0
  );

  if (loading) return <div className="animate-pulse h-96 bg-slate-100 rounded-xl" />;

  return (
    <div>
      {/* Active toggle + info banner */}
      <div className="border border-slate-200 rounded-xl p-5 mb-5 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-800 text-sm">
              ใช้งาน Config นี้กับ OpenClaw (หลิน)
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              เปิดเพื่อให้ OpenClaw ดึง prompt จาก DB แทนไฟล์ local
            </p>
          </div>
          <button
            role="switch"
            aria-checked={active}
            onClick={() => handleActiveToggle(!active)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              active ? "bg-green-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                active ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Status banner */}
        <div
          className={`mt-4 flex items-start gap-2.5 px-4 py-3 rounded-lg text-sm border ${
            active
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${active ? "bg-green-500" : "bg-amber-400"}`} />
          {active
            ? "OpenClaw จะดึง config นี้แทนไฟล์ local (SOUL.md, POSITIONS.md)"
            : "OpenClaw ใช้ไฟล์ local (SOUL.md, POSITIONS.md) — config นี้ยังไม่ได้ใช้งาน"}
        </div>
      </div>

      {/* Header bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-sm">
            <button
              onClick={() =>
                setOpenKeys(new Set(SECTIONS.map((s) => s.key)))
              }
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
                    n.has(section.key)
                      ? n.delete(section.key)
                      : n.add(section.key);
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
                  <span className="font-medium text-slate-800 text-sm">
                    {section.thLabel}
                  </span>
                  <span className="text-sm text-slate-400">
                    ({section.enLabel})
                  </span>
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
                      onChange={(e) =>
                        handleChange(section.key, e.target.value)
                      }
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
        <div className="flex items-center gap-2 mb-3">
          <ExternalLink className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-slate-800 text-sm">
            Export URL (สำหรับ OpenClaw)
          </span>
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
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "คัดลอกแล้ว" : "คัดลอก"}
          </button>
        </div>
      </div>
    </div>
  );
}
