"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Copy, Check, Eye, EyeOff, Trash2 } from "lucide-react";

type Props = {
  webhookUrl: string;
  isConfigured: boolean;
};

export default function IntegrationsClient({ webhookUrl, isConfigured }: Props) {
  const [configured, setConfigured] = useState(isConfigured);
  const [editing, setEditing] = useState(false);
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!secret || !token) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/integrations/line", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelSecret: secret, channelAccessToken: token }),
      });
      if (!res.ok) throw new Error("Save failed");
      setConfigured(true);
      setEditing(false);
      setSecret("");
      setToken("");
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("ยืนยันการยกเลิกการเชื่อมต่อ LINE?")) return;
    await fetch("/api/integrations/line", { method: "DELETE" });
    setConfigured(false);
    setEditing(false);
  }

  async function copyWebhook() {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-slate-500 mt-1">Manage channel connections and webhook settings</p>
      </div>

      {/* LINE */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              L
            </div>
            <div>
              <p className="font-semibold text-slate-900">LINE Official Account</p>
              <p className="text-sm text-slate-500">Daniel HR bot — รับข้อความจาก candidate ผ่าน LINE</p>
            </div>
          </div>
          {configured ? (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full">
              <CheckCircle className="w-4 h-4" /> เชื่อมต่อแล้ว
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
              <XCircle className="w-4 h-4" /> ยังไม่ได้เชื่อมต่อ
            </span>
          )}
        </div>

        {/* Webhook URL */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-1.5">Webhook URL</p>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <code className="text-sm text-slate-800 flex-1 break-all select-all">{webhookUrl}</code>
            <button
              onClick={copyWebhook}
              className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Copy URL นี้ไปใส่ใน LINE Developer Console → Messaging API → Webhook URL
          </p>
        </div>

        {/* Form */}
        {!editing && !configured && (
          <button
            onClick={() => setEditing(true)}
            className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            เชื่อมต่อ LINE
          </button>
        )}

        {!editing && configured && (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              แก้ไข Credentials
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" /> ยกเลิกการเชื่อมต่อ
            </button>
          </div>
        )}

        {editing && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Channel Secret
              </label>
              <div className="relative">
                <input
                  type={showSecret ? "text" : "password"}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="กรอก Channel Secret"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Channel Access Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="กรอก Channel Access Token"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button
                onClick={() => { setEditing(false); setSecret(""); setToken(""); setError(""); }}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Setup guide */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 space-y-1">
          <p className="font-medium">วิธีตั้งค่า</p>
          <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
            <li>ไปที่ LINE Developers Console → เลือก channel → Messaging API</li>
            <li>Copy Webhook URL ด้านบน ไปใส่ใน Webhook URL → เปิด Use webhook</li>
            <li>กลับมากรอก Channel Secret และ Channel Access Token แล้วกด บันทึก</li>
            <li>ทดสอบส่ง LINE message — ข้อความจะขึ้นใน Inbox อัตโนมัติ</li>
          </ol>
        </div>
      </div>

      {/* Daniel HR Bot */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            AI
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Daniel HR Bot</p>
            <p className="text-sm text-slate-500">Kimi AI — ตอบ candidate อัตโนมัติ 6 ขั้นตอน</p>
          </div>
          {process.env.NEXT_PUBLIC_KIMI_CONFIGURED === "true" ? (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full">
              <CheckCircle className="w-4 h-4" /> พร้อมใช้งาน
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
              <CheckCircle className="w-4 h-4 text-green-500" /> พร้อมใช้งาน
            </span>
          )}
        </div>
      </div>

      {/* Facebook coming soon */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 opacity-50 pointer-events-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              f
            </div>
            <div>
              <p className="font-semibold text-slate-900">Facebook Messenger</p>
              <p className="text-sm text-slate-500">Coming soon</p>
            </div>
          </div>
          <span className="text-sm text-slate-400 font-medium">เร็วๆ นี้</span>
        </div>
      </div>
    </div>
  );
}
