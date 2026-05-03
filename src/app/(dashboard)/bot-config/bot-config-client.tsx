"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Bot, Save, Clock } from "lucide-react";

type Section = {
  key: string;
  label: string;
  labelEn: string;
  placeholder: string;
  rows: number;
};

const SECTIONS: Section[] = [
  {
    key: "objectives",
    label: "เป้าหมายหลัก",
    labelEn: "Primary Objectives",
    placeholder:
      "ระบุเป้าหมายหลักของบอท เช่น คัดกรองผู้สมัครเบื้องต้น รวบรวมข้อมูลพื้นฐาน นัดสัมภาษณ์...",
    rows: 4,
  },
  {
    key: "company_info",
    label: "ข้อมูลบริษัท",
    labelEn: "Company Info",
    placeholder:
      "ข้อมูลบริษัท วัฒนธรรมองค์กร สวัสดิการ สิ่งที่ทำให้บริษัทน่าสนใจ...",
    rows: 6,
  },
  {
    key: "conversation_flow",
    label: "ลำดับการสนทนา",
    labelEn: "Conversation Flow",
    placeholder:
      "1. ทักทายและแนะนำตัว\n2. ถามตำแหน่งที่สนใจ\n3. ขอชื่อ-นามสกุลและอายุ\n4. ถามประสบการณ์ทำงาน\n5. ถามเงินเดือนที่ต้องการ\n6. ถามวันเริ่มงาน\n7. ขอบคุณและแจ้งว่า HR จะติดต่อกลับ",
    rows: 8,
  },
  {
    key: "response_guidelines",
    label: "แนวทางการตอบ",
    labelEn: "Response Guidelines",
    placeholder:
      "ระบุ tone, ภาษา, สไตล์การตอบ เช่น ตอบภาษาไทย กระชับ สุภาพ ใช้ emoji ได้บ้าง...",
    rows: 5,
  },
  {
    key: "open_positions",
    label: "ตำแหน่งที่เปิดรับ",
    labelEn: "Open Positions",
    placeholder:
      "รายละเอียดตำแหน่งงานที่เปิดรับ เช่น Sales Admin, Telesales, Content Creator...",
    rows: 6,
  },
  {
    key: "critical_rules",
    label: "กฎสำคัญ",
    labelEn: "Critical Rules",
    placeholder:
      "สิ่งที่บอทต้องทำ/ห้ามทำ เช่น ห้ามระบุเงินเดือน, ห้ามตัดสินใจรับแทน HR...",
    rows: 5,
  },
  {
    key: "contact_info",
    label: "ข้อมูลติดต่อ HR",
    labelEn: "Contact Info",
    placeholder: "ชื่อ HR, เบอร์โทร, อีเมล, ที่อยู่บริษัท...",
    rows: 4,
  },
  {
    key: "custom_instructions",
    label: "คำสั่งเพิ่มเติม",
    labelEn: "Custom Instructions",
    placeholder: "คำสั่งพิเศษอื่นๆ ที่ต้องการให้บอทปฏิบัติตาม...",
    rows: 5,
  },
];

type Config = Record<string, string>;

type Props = {
  initialConfig: Config;
  canEdit: boolean;
};

export default function BotConfigClient({ initialConfig, canEdit }: Props) {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map((s) => [s.key, true]))
  );
  const [saving, setSaving] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActive = config.active !== "false";

  const filledCount = SECTIONS.filter((s) => (config[s.key] ?? "").trim().length > 0).length;
  const allOpen = SECTIONS.every((s) => openSections[s.key]);

  const saveConfig = useCallback(
    async (data: Config) => {
      setSaving(true);
      try {
        const res = await fetch("/api/bot-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error();
        setLastSaved(new Date());
        toast.success("บันทึกการตั้งค่าบอทแล้ว");
      } catch {
        toast.error("บันทึกไม่สำเร็จ");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const handleChange = (key: string, value: string) => {
    const next = { ...config, [key]: value };
    setConfig(next);

    if (autoSave && canEdit) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => saveConfig(next), 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAll = () => {
    const next = !allOpen;
    setOpenSections(Object.fromEntries(SECTIONS.map((s) => [s.key, next])));
  };

  const toggleActive = async () => {
    if (!canEdit) return;
    const next = { ...config, active: isActive ? "false" : "true" };
    setConfig(next);
    await saveConfig(next);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3">
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <button onClick={toggleAll} className="hover:text-blue-600 transition-colors">
            {allOpen ? "ปิดทั้งหมด" : "เปิดทั้งหมด"}
          </button>
          <span className="text-slate-300">|</span>
          <span>
            <span className="font-semibold text-slate-800">{filledCount}</span>
            <span className="text-slate-400">/{SECTIONS.length} หมวดที่กรอกแล้ว</span>
          </span>
          {lastSaved && (
            <>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                บันทึกแล้ว {lastSaved.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-save toggle */}
          {canEdit && (
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <div
                onClick={() => setAutoSave((v) => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors ${autoSave ? "bg-blue-500" : "bg-slate-300"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoSave ? "translate-x-4" : "translate-x-0"}`}
                />
              </div>
              Auto-save
            </label>
          )}

          {/* Active toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <div
              onClick={toggleActive}
              className={`relative w-9 h-5 rounded-full transition-colors ${isActive ? "bg-green-500" : "bg-slate-300"} ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? "translate-x-4" : "translate-x-0"}`}
              />
            </div>
            <span className={isActive ? "text-green-600 font-medium" : "text-slate-500"}>
              {isActive ? "Active" : "Inactive"}
            </span>
          </label>

          {canEdit && (
            <button
              onClick={() => saveConfig(config)}
              disabled={saving}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {SECTIONS.map((section) => {
          const value = config[section.key] ?? "";
          const isOpen = openSections[section.key];
          const charCount = value.length;
          const filled = value.trim().length > 0;

          return (
            <div
              key={section.key}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${filled ? "bg-green-500" : "bg-slate-300"}`} />
                  <span className="font-medium text-slate-800">{section.label}</span>
                  <span className="text-sm text-slate-400">({section.labelEn})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400">{charCount.toLocaleString()} ตัวอักษร</span>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Section Content */}
              {isOpen && (
                <div className="px-5 pb-4 border-t border-slate-100">
                  <textarea
                    value={value}
                    onChange={(e) => handleChange(section.key, e.target.value)}
                    placeholder={section.placeholder}
                    rows={section.rows}
                    disabled={!canEdit}
                    className="mt-3 w-full text-sm text-slate-700 placeholder:text-slate-300 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Preview */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Bot className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-700">System Prompt Preview</span>
        </div>
        <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
          {SECTIONS.map((s) => {
            const v = (config[s.key] ?? "").trim();
            if (!v) return null;
            return `## ${s.label} (${s.labelEn})\n${v}`;
          })
            .filter(Boolean)
            .join("\n\n") || "ยังไม่มีการตั้งค่า"}
        </pre>
      </div>
    </div>
  );
}
