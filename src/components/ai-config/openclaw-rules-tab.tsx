"use client";

import { useEffect, useState } from "react";
import {
  Save,
  Loader2,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
  FileText,
  Download,
  Upload,
  Clock,
} from "lucide-react";

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

export function OpenClawRulesTab() {
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
  const [filesDirty, setFilesDirty] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [filePulled, setFilePulled] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [savingEnabled, setSavingEnabled] = useState(false);
  const [serverConfig, setServerConfig] = useState<OpenClawServerConfig>({
    enabled: true,
    model: "default",
    temperature: 0.7,
    max_tokens: 500,
    system_prompt: "",
  });
  const [connection, setConnection] = useState<OpenClawConnection | null>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMeta();
    loadFiles();
  }, []);

  async function loadMeta() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/ai/openclaw");
      if (res.ok) {
        const data = await res.json();
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
    } finally {
      setLoading(false);
    }
  }

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

  async function copyUrl() {
    await navigator.clipboard.writeText(CONFIG_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

      {/* Pending sync banner */}
      {filesDirty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-medium">รอ middleware.py ดึงไป</span> — ไฟล์ใน DB ล่าสุดกว่าไฟล์ในบอท (sync ภายใน 5 นาที)
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
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-60 font-medium min-w-[130px] justify-center"
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
