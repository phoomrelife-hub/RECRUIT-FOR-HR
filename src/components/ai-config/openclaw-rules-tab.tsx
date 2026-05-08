"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Download,
  Upload,
  Clock,
  Info,
} from "lucide-react";

const WORKSPACE_FILES = ["SOUL.md", "POSITIONS.md", "RULES.md", "EXAMPLES.md"] as const;
type WorkspaceFile = (typeof WORKSPACE_FILES)[number];

const FILE_META: Record<WorkspaceFile, { emoji: string; title: string; desc: string }> = {
  "SOUL.md": {
    emoji: "🧠",
    title: "บุคลิกและกฎหลัก",
    desc: "น้ำเสียง วิธีลงท้าย กฎที่หลินต้องปฏิบัติเสมอ เช่น ห้าม re-greet ห้ามแต่งข้อมูล closing message",
  },
  "POSITIONS.md": {
    emoji: "💼",
    title: "ข้อมูลตำแหน่งงาน",
    desc: "ตำแหน่งที่เปิดรับ เงินเดือน คุณสมบัติ เวลาทำงาน สวัสดิการ ลิงก์ฟอร์มสมัคร",
  },
  "RULES.md": {
    emoji: "📋",
    title: "กฎและขั้นตอนการคุย",
    desc: "ลำดับการสนทนา วิธีรับมือคำถามพิเศษ edge cases เช่น คำถามนอกเรื่อง ขอข้อมูลเพิ่ม",
  },
  "EXAMPLES.md": {
    emoji: "💬",
    title: "ตัวอย่างบทสนทนา",
    desc: "ตัวอย่าง Q&A จริงสำหรับ few-shot prompting ช่วยให้หลินเข้าใจรูปแบบการตอบที่ถูกต้อง",
  },
};

const CONFIG_URL = "https://recruit-for-hr.vercel.app/api/openclaw/config";

export function OpenClawRulesTab() {
  const [activeFile, setActiveFile] = useState<WorkspaceFile>("SOUL.md");
  const [fileContents, setFileContents] = useState<Record<WorkspaceFile, string>>({
    "SOUL.md": "",
    "POSITIONS.md": "",
    "RULES.md": "",
    "EXAMPLES.md": "",
  });
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesSaving, setFilesSaving] = useState(false);
  const [filesSavedAt, setFilesSavedAt] = useState<Date | null>(null);
  const [filesDirty, setFilesDirty] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [filePulled, setFilePulled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    setFilesLoading(true);
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
    setFilesLoading(false);
  }

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
      setFilesDirty(true);
    } catch (e) {
      setFilesError(`บันทึกไม่สำเร็จ: ${e}`);
    }
    setFilesSaving(false);
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(CONFIG_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const meta = FILE_META[activeFile];

  return (
    <div>
      {/* Pending sync banner */}
      {filesDirty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-medium">รอ middleware.py ดึงไป</span> — ไฟล์ใน DB ล่าสุดกว่าไฟล์ในบอท (sync ภายใน 5 นาที)
          </p>
        </div>
      )}

      {/* File tabs */}
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-1">
          {WORKSPACE_FILES.map((fname) => {
            const m = FILE_META[fname];
            const chars = fileContents[fname]?.length ?? 0;
            const isActive = activeFile === fname;
            return (
              <button
                key={fname}
                onClick={() => setActiveFile(fname)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors font-mono ${
                  isActive ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{m.emoji}</span>
                {fname}
                {chars > 0 && (
                  <span className={`text-xs tabular-nums ${isActive ? "text-slate-300" : "text-slate-400"}`}>
                    {chars.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {filesError && (
            <span className="text-xs text-red-500 font-medium max-w-xs truncate">{filesError}</span>
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
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-60 font-medium min-w-[130px] justify-center transition-colors"
          >
            {filesSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : filesSavedAt ? (
              <><Check className="h-3.5 w-3.5" /> บันทึกแล้ว</>
            ) : (
              <><Upload className="h-3.5 w-3.5" /> ↑ บันทึก & Push</>
            )}
          </button>
        </div>
      </div>

      {/* File description */}
      <div className="flex items-center gap-2 px-1 mb-3 min-h-[20px]">
        <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-600">{meta.title}</span>
          {" — "}
          {meta.desc}
        </p>
      </div>

      {filesSavedAt && !filesSaving && (
        <p className="text-xs text-slate-400 text-right mb-2">
          บันทึกแล้วเมื่อ {filesSavedAt.toLocaleTimeString("th-TH")} · middleware.py จะ sync ภายใน 5 นาที
        </p>
      )}

      {/* File editor */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        {/* Titlebar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border-b border-slate-700">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="h-3 w-3 rounded-full bg-yellow-500" />
          <span className="h-3 w-3 rounded-full bg-green-500" />
          <span className="text-xs text-slate-300 font-mono ml-2">/workspace-hr/{activeFile}</span>
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
            <p className="text-xs text-slate-300">ต้องการให้ middleware.py รันและ push ขึ้นมาก่อน</p>
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

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 mt-1 text-xs text-slate-400">
        <span>การเปลี่ยนแปลงจะมีผลกับบอทภายใน 5 นาที (middleware.py poll ทุก 5 นาที)</span>
        <span className="font-mono">
          {(fileContents[activeFile]?.length ?? 0).toLocaleString()} chars · {activeFile}
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
    </div>
  );
}
