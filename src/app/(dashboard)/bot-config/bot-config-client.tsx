"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Save, Bot, Power } from "lucide-react";

const SECTIONS = [
  { key: "objectives", label: "เป้าหมายหลัก", labelEn: "Primary Objectives", rows: 4,
    placeholder: "บอทมีหน้าที่อะไร เช่น คัดกรองผู้สมัคร รวบรวมข้อมูล นัดสัมภาษณ์..." },
  { key: "company_info", label: "ข้อมูลบริษัท", labelEn: "Company Info", rows: 5,
    placeholder: "ชื่อบริษัท วัฒนธรรมองค์กร สวัสดิการ จุดเด่น..." },
  { key: "conversation_flow", label: "ลำดับการสนทนา", labelEn: "Conversation Flow", rows: 8,
    placeholder: "1. ทักทายและแนะนำตัว\n2. ถามตำแหน่งที่สนใจ\n3. ขอชื่อ-นามสกุลและอายุ\n4. ถามประสบการณ์\n5. ถามเงินเดือนที่ต้องการ\n6. ถามวันเริ่มงาน\n7. ขอบคุณและแจ้งว่า HR จะติดต่อกลับ" },
  { key: "response_guidelines", label: "แนวทางการตอบ", labelEn: "Response Guidelines", rows: 4,
    placeholder: "ตอบภาษาไทย กระชับ สุภาพ เป็นมิตร ใช้ emoji ได้บ้าง ถามทีละคำถาม..." },
  { key: "open_positions", label: "ตำแหน่งที่เปิดรับ", labelEn: "Open Positions", rows: 5,
    placeholder: "รายละเอียดตำแหน่งที่เปิดรับ เช่น Sales Admin, Telesales, Content Creator..." },
  { key: "critical_rules", label: "กฎสำคัญ", labelEn: "Critical Rules", rows: 4,
    placeholder: "ห้ามระบุเงินเดือน, ห้ามตัดสินใจรับแทน HR, ห้ามพูดถึงคู่แข่ง..." },
  { key: "contact_info", label: "ข้อมูลติดต่อ HR", labelEn: "Contact Info", rows: 3,
    placeholder: "ชื่อ HR, เบอร์โทร, อีเมล, ที่อยู่บริษัท..." },
  { key: "custom_instructions", label: "คำสั่งเพิ่มเติม", labelEn: "Custom Instructions", rows: 4,
    placeholder: "คำสั่งพิเศษอื่นๆ ที่ต้องการให้บอทปฏิบัติตาม..." },
];

type Config = Record<string, string>;

export default function BotConfigClient({
  initialConfig, canEdit,
}: { initialConfig: Config; canEdit: boolean }) {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map((s) => [s.key, true]))
  );
  const [saving, setSaving] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = config.active !== "false";
  const filledCount = SECTIONS.filter((s) => (config[s.key] ?? "").trim()).length;
  const allOpen = SECTIONS.every((s) => openSections[s.key]);

  const save = useCallback(async (data: Config) => {
    setSaving(true);
    try {
      const res = await fetch("/api/bot-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success("บันทึกแล้ว");
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }, []);

  const handleChange = (key: string, value: string) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    if (autoSave && canEdit) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => save(next), 2000);
    }
  };

  const toggleActive = async () => {
    if (!canEdit) return;
    const next = { ...config, active: isActive ? "false" : "true" };
    setConfig(next);
    await save(next);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3">
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <button onClick={() => setOpenSections(Object.fromEntries(SECTIONS.map((s) => [s.key, !allOpen])))}
            className="hover:text-blue-600 transition-colors">
            {allOpen ? "ปิดทั้งหมด" : "เปิดทั้งหมด"}
          </button>
          <span className="text-slate-300">|</span>
          <span>
            <span className="font-semibold text-slate-800">{filledCount}</span>
            <span className="text-slate-400">/{SECTIONS.length} หมวดที่กรอกแล้ว</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {canEdit && (
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <div onClick={() => setAutoSave((v) => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${autoSave ? "bg-blue-500" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoSave ? "translate-x-4" : ""}`} />
              </div>
              Auto-save
            </label>
          )}

          <button onClick={toggleActive} disabled={!canEdit}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"} disabled:opacity-50`}>
            <Power className="h-3.5 w-3.5" />
            {isActive ? "Active" : "Inactive"}
          </button>

          {canEdit && (
            <button onClick={() => save(config)} disabled={saving}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
              <Save className="h-3.5 w-3.5" />
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {SECTIONS.map((section) => {
          const value = config[section.key] ?? "";
          const isOpen = openSections[section.key];
          return (
            <div key={section.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => setOpenSections((p) => ({ ...p, [section.key]: !p[section.key] }))}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${value.trim() ? "bg-green-500" : "bg-slate-300"}`} />
                  <span className="font-medium text-slate-800">{section.label}</span>
                  <span className="text-sm text-slate-400">({section.labelEn})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400">{value.length.toLocaleString()} ตัวอักษร</span>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-4 border-t border-slate-100">
                  <textarea value={value} onChange={(e) => handleChange(section.key, e.target.value)}
                    placeholder={section.placeholder} rows={section.rows} disabled={!canEdit}
                    className="mt-3 w-full text-sm text-slate-700 placeholder:text-slate-300 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* System Prompt Preview */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Bot className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-700">System Prompt Preview</span>
        </div>
        <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
          {SECTIONS.map((s) => {
            const v = (config[s.key] ?? "").trim();
            return v ? `## ${s.label}\n${v}` : null;
          }).filter(Boolean).join("\n\n") || "ยังไม่มีการตั้งค่า — จะใช้ default prompt"}
        </pre>
      </div>
    </div>
  );
}
