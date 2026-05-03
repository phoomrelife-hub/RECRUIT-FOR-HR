"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Save, History, Loader2, Check } from "lucide-react";

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

export function BotPromptTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [hasError, setHasError] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = useRef(false);

  useEffect(() => {
    load();
  }, []);

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
      }
    } catch {
      setHasError(true);
    }
    setLoading(false);
  }

  async function save(vals = values, isActive = active) {
    setSaving(true);
    setHasError(false);
    try {
      const res = await fetch("/api/settings/ai/bot-prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...vals, active: isActive ? "true" : "false" }),
      });
      if (!res.ok) throw new Error();
      setSavedAt(new Date());
      isDirty.current = false;
    } catch {
      setHasError(true);
    }
    setSaving(false);
  }

  function handleChange(key: string, val: string) {
    const next = { ...values, [key]: val };
    setValues(next);
    isDirty.current = true;
    if (autoSave) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => save(next, active), 2000);
    }
  }

  function handleActiveToggle(checked: boolean) {
    setActive(checked);
    if (autoSave) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => save(values, checked), 2000);
    }
  }

  function toggleSection(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const filledCount = CONTENT_KEYS.filter((k) => (values[k] ?? "").trim().length > 0).length;
  const totalChars = CONTENT_KEYS.reduce((sum, k) => sum + (values[k] ?? "").length, 0);

  if (loading) return <div className="animate-pulse h-96 bg-slate-100 rounded-xl" />;

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-sm">
            <button
              onClick={() => setOpenKeys(new Set(CONTENT_KEYS))}
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
              className={`relative w-9 h-5 rounded-full transition-colors ${autoSave ? "bg-blue-500" : "bg-slate-300"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${autoSave ? "translate-x-4" : "translate-x-0"}`}
              />
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
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? "translate-x-4" : "translate-x-0"}`}
              />
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
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left bg-white"
              >
                <div className="flex items-center gap-3">
                  <ChevronRight
                    className={`h-4 w-4 text-slate-400 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`}
                  />
                  <span className="font-medium text-slate-800 text-sm">
                    {section.thLabel}
                  </span>
                  <span className="text-sm text-slate-400">
                    ({section.enLabel})
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${isFilled ? "bg-green-500" : "bg-slate-300"}`}
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
    </div>
  );
}
