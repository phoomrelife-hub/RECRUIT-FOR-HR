"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, CheckCircle, XCircle, Save, Check } from "lucide-react";

interface OpenClawConfig {
  enabled: boolean;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
}

interface ConnectionStatus {
  ok: boolean;
  version?: string;
  error?: string;
}

export function OpenClawTab() {
  const [config, setConfig] = useState<OpenClawConfig>({
    enabled: true,
    model: "default",
    temperature: 0.7,
    max_tokens: 500,
    system_prompt: "",
  });
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/bot-config/openclaw");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setConnection(data.connection);
        setAvailableModels(data.availableModels || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/bot-config/openclaw");
      if (res.ok) {
        const data = await res.json();
        setConnection(data.connection);
      }
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/bot-config/openclaw", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="animate-pulse h-96 bg-slate-100 rounded-xl" />;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Connection Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">สถานะการเชื่อมต่อ</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {connection?.ok
                ? `เชื่อมต่อแล้ว${connection.version ? ` · v${connection.version}` : ""}`
                : connection?.error ?? "ไม่สามารถเชื่อมต่อได้"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {connection?.ok ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                <CheckCircle className="h-3.5 w-3.5" /> เชื่อมต่อแล้ว
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
                <XCircle className="h-3.5 w-3.5" /> ไม่ได้เชื่อมต่อ
              </span>
            )}
            <button
              onClick={testConnection}
              disabled={testing}
              className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
              ทดสอบอีกครั้ง
            </button>
          </div>
        </div>
      </div>

      {/* Main Config */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <p className="text-sm font-semibold text-slate-800">ตั้งค่า OpenClaw</p>

        {/* Enable toggle */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-slate-700">เปิดใช้งาน OpenClaw</p>
            <p className="text-xs text-slate-400 mt-0.5">ปิดถ้าต้องการใช้ Kimi/Qwen เป็น AI หลักแทน</p>
          </div>
          <button
            onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              config.enabled ? "bg-blue-600" : "bg-slate-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                config.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Model */}
        <div className="space-y-1.5 border-t border-slate-100 pt-4">
          <label className="text-sm font-medium text-slate-700">โมเดล</label>
          <div className="flex gap-2">
            <input
              value={config.model}
              onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value }))}
              placeholder="default"
              list="openclaw-models"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {availableModels.length > 0 && (
              <datalist id="openclaw-models">
                {availableModels.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            )}
          </div>
          <p className="text-xs text-slate-400">ใช้ "default" ถ้าต้องการให้ OpenClaw เลือกโมเดลอัตโนมัติ</p>
        </div>

        {/* Temperature */}
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Temperature</label>
            <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {config.temperature.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={config.temperature}
            onChange={(e) => setConfig((c) => ({ ...c, temperature: parseFloat(e.target.value) }))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>ตอบแบบเดียวกันเสมอ</span>
            <span>สร้างสรรค์มากขึ้น</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div className="space-y-1.5 border-t border-slate-100 pt-4">
          <label className="text-sm font-medium text-slate-700">Max Tokens</label>
          <input
            type="number"
            value={config.max_tokens}
            onChange={(e) => setConfig((c) => ({ ...c, max_tokens: parseInt(e.target.value) || 500 }))}
            min={100}
            max={4000}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400">จำนวน token สูงสุดที่ตอบกลับ (1 token ≈ 4 ตัวอักษรภาษาไทย)</p>
        </div>

        {/* System Prompt */}
        <div className="space-y-1.5 border-t border-slate-100 pt-4">
          <label className="text-sm font-medium text-slate-700">System Prompt <span className="text-slate-400 font-normal">(Optional)</span></label>
          <textarea
            value={config.system_prompt}
            onChange={(e) => setConfig((c) => ({ ...c, system_prompt: e.target.value }))}
            rows={5}
            placeholder="ใส่ system prompt เฉพาะที่ต้องการ override ค่าเริ่มต้น..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400">ถ้าเว้นว่าง จะใช้ prompt จาก Bot Prompt tab แทน</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-blue-800 mb-2">วิธีการทำงาน</p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside leading-relaxed">
          <li>OpenClaw จะเป็น AI หลักที่ตอบผู้สมัครผ่าน LINE</li>
          <li>ถ้า OpenClaw ไม่ตอบ ระบบจะ fallback ไปใช้ Kimi/Qwen อัตโนมัติ</li>
          <li>System prompt จาก Bot Prompt tab จะถูกส่งไป OpenClaw ทุกครั้ง</li>
          <li>การตั้งค่านี้มีผลทันทีหลังบันทึก (ไม่ต้อง restart server)</li>
        </ul>
      </div>

      {/* Save */}
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
