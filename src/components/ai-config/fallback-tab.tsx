"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

interface FallbackSetting {
  id?: string;
  enabled: boolean;
  maxRetries: number;
  fallbackMessage: string | null;
  notifyHr: boolean;
}

export function FallbackTab() {
  const [setting, setSetting] = useState<FallbackSetting>({
    enabled: true,
    maxRetries: 2,
    fallbackMessage: null,
    notifyHr: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/ai/fallback")
      .then((r) => r.json())
      .then((d) => { if (d) setSetting({ ...d, fallbackMessage: d.fallbackMessage ?? "" }); })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/settings/ai/fallback", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(setting),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-semibold text-slate-800">Fallback Settings</h2>
        <p className="text-sm text-slate-500">กำหนดพฤติกรรมเมื่อ AI ตอบไม่ได้หรือเกิดข้อผิดพลาด</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-700 text-sm">Enable Fallback</p>
            <p className="text-xs text-slate-400">เปิดใช้ระบบ fallback เมื่อ AI ไม่ตอบสนอง</p>
          </div>
          <button
            onClick={() => setSetting((s) => ({ ...s, enabled: !s.enabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${setting.enabled ? "bg-blue-600" : "bg-slate-200"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${setting.enabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Max Retries</label>
          <p className="text-xs text-slate-400">จำนวนครั้งที่ลองใหม่ก่อน fallback</p>
          <input
            type="number"
            min={0}
            max={5}
            value={setting.maxRetries}
            onChange={(e) => setSetting((s) => ({ ...s, maxRetries: parseInt(e.target.value) || 0 }))}
            className="w-24 border border-slate-200 rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Fallback Message</label>
          <p className="text-xs text-slate-400">ข้อความที่จะส่งให้ candidate เมื่อ AI ล้มเหลว</p>
          <textarea
            value={setting.fallbackMessage ?? ""}
            onChange={(e) => setSetting((s) => ({ ...s, fallbackMessage: e.target.value }))}
            rows={3}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none"
            placeholder="ขออภัยค่ะ ขณะนี้ระบบไม่สามารถตอบได้ HR จะติดต่อกลับเร็วๆ นี้ค่ะ"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-700 text-sm">Notify HR on Fallback</p>
            <p className="text-xs text-slate-400">แจ้งเตือน HR เมื่อ fallback เกิดขึ้น</p>
          </div>
          <button
            onClick={() => setSetting((s) => ({ ...s, notifyHr: !s.notifyHr }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${setting.notifyHr ? "bg-blue-600" : "bg-slate-200"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${setting.notifyHr ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  );
}
