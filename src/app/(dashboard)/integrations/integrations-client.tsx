"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Copy, Check, Eye, EyeOff, Trash2, Link } from "lucide-react";

type Props = {
  syncUrl: string;
  isLineConfigured: boolean;
  openclawLineWebhook: string;
  syncSecret: string;
};

function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div>
      {label && <p className="text-sm font-medium text-slate-700 mb-1.5">{label}</p>}
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
        <code className="text-sm text-slate-800 flex-1 break-all select-all">{value}</code>
        <button onClick={copy} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function IntegrationsClient({
  syncUrl,
  isLineConfigured,
  openclawLineWebhook,
  syncSecret,
}: Props) {
  // LINE credentials state
  const [lineConfigured, setLineConfigured] = useState(isLineConfigured);
  const [editingLine, setEditingLine] = useState(false);
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [lineSaving, setLineSaving] = useState(false);
  const [lineError, setLineError] = useState("");

  // OpenClaw state
  const [ocWebhook, setOcWebhook] = useState(openclawLineWebhook);
  const [editingOc, setEditingOc] = useState(false);
  const [ocInput, setOcInput] = useState(openclawLineWebhook);
  const [ocSaving, setOcSaving] = useState(false);
  const [ocError, setOcError] = useState("");

  // ── LINE handlers ──────────────────────────────────
  async function handleLineSave() {
    if (!secret || !token) { setLineError("กรุณากรอกข้อมูลให้ครบ"); return; }
    setLineSaving(true); setLineError("");
    try {
      const res = await fetch("/api/integrations/line", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelSecret: secret, channelAccessToken: token }),
      });
      if (!res.ok) throw new Error();
      setLineConfigured(true); setEditingLine(false); setSecret(""); setToken("");
    } catch { setLineError("บันทึกไม่สำเร็จ"); }
    finally { setLineSaving(false); }
  }

  async function handleLineDisconnect() {
    if (!confirm("ยืนยันการยกเลิกการเชื่อมต่อ LINE?")) return;
    await fetch("/api/integrations/line", { method: "DELETE" });
    setLineConfigured(false); setEditingLine(false);
  }

  // ── OpenClaw handlers ──────────────────────────────
  async function handleOcSave() {
    if (!ocInput.startsWith("https://")) { setOcError("URL ต้องขึ้นต้นด้วย https://"); return; }
    setOcSaving(true); setOcError("");
    try {
      const res = await fetch("/api/integrations/openclaw", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineWebhookUrl: ocInput }),
      });
      if (!res.ok) throw new Error();
      setOcWebhook(ocInput); setEditingOc(false);
    } catch { setOcError("บันทึกไม่สำเร็จ"); }
    finally { setOcSaving(false); }
  }

  async function handleOcDisconnect() {
    if (!confirm("ยืนยันการลบ OpenClaw Webhook URL?")) return;
    await fetch("/api/integrations/openclaw", { method: "DELETE" });
    setOcWebhook(""); setOcInput(""); setEditingOc(false);
  }

  const lineWebhookUrl = ocWebhook || `${syncUrl.replace("/api/openclaw/sync", "")}/api/webhooks/line`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-slate-500 mt-1">Manage channel connections and webhook settings</p>
      </div>

      {/* ── LINE Official Account ─────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">L</div>
            <div>
              <p className="font-semibold text-slate-900">LINE Official Account</p>
              <p className="text-sm text-slate-500">Daniel HR bot — รับข้อความจาก candidate ผ่าน LINE</p>
            </div>
          </div>
          {lineConfigured ? (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full">
              <CheckCircle className="w-4 h-4" /> เชื่อมต่อแล้ว
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
              <XCircle className="w-4 h-4" /> ยังไม่ได้เชื่อมต่อ
            </span>
          )}
        </div>

        {/* Webhook URL — ถ้ามี OpenClaw จะชี้ไปที่ OpenClaw */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-sm font-medium text-slate-700">Webhook URL (ใส่ใน LINE Developers Console)</p>
            {ocWebhook && (
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">via OpenClaw</span>
            )}
          </div>
          <CopyField value={lineWebhookUrl} />
          <p className="text-xs text-slate-400 mt-1">
            {ocWebhook
              ? "URL นี้คือ OpenClaw webhook — LINE จะส่งข้อความไปหา OpenClaw แล้ว sync มาที่ระบบนี้"
              : "Copy URL นี้ไปใส่ใน LINE Developer Console → Messaging API → Webhook URL"}
          </p>
        </div>

        {/* Credentials form */}
        {!editingLine && !lineConfigured && (
          <button onClick={() => setEditingLine(true)}
            className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors">
            เชื่อมต่อ LINE
          </button>
        )}
        {!editingLine && lineConfigured && (
          <div className="flex gap-2">
            <button onClick={() => setEditingLine(true)}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              แก้ไข Credentials
            </button>
            <button onClick={handleLineDisconnect}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" /> ยกเลิก
            </button>
          </div>
        )}
        {editingLine && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Channel Secret</label>
              <div className="relative">
                <input type={showSecret ? "text" : "password"} value={secret} onChange={(e) => setSecret(e.target.value)}
                  placeholder="กรอก Channel Secret"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Channel Access Token</label>
              <div className="relative">
                <input type={showToken ? "text" : "password"} value={token} onChange={(e) => setToken(e.target.value)}
                  placeholder="กรอก Channel Access Token"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {lineError && <p className="text-sm text-red-500">{lineError}</p>}
            <div className="flex gap-2">
              <button onClick={handleLineSave} disabled={lineSaving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {lineSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button onClick={() => { setEditingLine(false); setSecret(""); setToken(""); setLineError(""); }}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors">
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── OpenClaw ──────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <Link className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">OpenClaw — Daniel HR Agent</p>
              <p className="text-sm text-slate-500">Sync ข้อความจาก OpenClaw agent เข้า inbox</p>
            </div>
          </div>
          {ocWebhook ? (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full">
              <CheckCircle className="w-4 h-4" /> ตั้งค่าแล้ว
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
              <XCircle className="w-4 h-4" /> ยังไม่ได้ตั้งค่า
            </span>
          )}
        </div>

        {/* Sync endpoint — readonly */}
        <CopyField value={syncUrl} label="Sync Endpoint (OpenClaw POST มาที่นี่)" />
        <p className="text-xs text-slate-400 -mt-3">
          ตั้งใน OpenClaw ให้ POST มาที่ URL นี้ พร้อม header{" "}
          <code className="bg-slate-100 px-1 rounded">x-openclaw-secret</code>
        </p>

        {/* Sync Secret status */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-600 font-medium">Sync Secret:</span>
          {syncSecret ? (
            <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> ตั้งค่าแล้ว (OPENCLAW_SYNC_SECRET)</span>
          ) : (
            <span className="text-amber-500">ยังไม่ได้ตั้ง — เพิ่ม OPENCLAW_SYNC_SECRET ใน Vercel env vars</span>
          )}
        </div>

        {/* OpenClaw LINE Webhook URL — editable */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-1.5">
            OpenClaw LINE Webhook URL{" "}
            <span className="text-slate-400 font-normal">(ngrok URL ของ OpenClaw)</span>
          </p>
          {!editingOc ? (
            <div className="space-y-2">
              {ocWebhook ? (
                <CopyField value={ocWebhook} />
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-400">
                  ยังไม่ได้กรอก — OpenClaw ngrok URL ที่ LINE จะส่งข้อความมาหา
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setOcInput(ocWebhook); setEditingOc(true); }}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors">
                  {ocWebhook ? "แก้ไข URL" : "กรอก URL"}
                </button>
                {ocWebhook && (
                  <button onClick={handleOcDisconnect}
                    className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" /> ลบ
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="url"
                value={ocInput}
                onChange={(e) => setOcInput(e.target.value)}
                placeholder="https://xxxx.ngrok.io/openclaw/line/webhook"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {ocError && <p className="text-sm text-red-500">{ocError}</p>}
              <div className="flex gap-2">
                <button onClick={handleOcSave} disabled={ocSaving}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                  {ocSaving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button onClick={() => { setEditingOc(false); setOcError(""); }}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors">
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Setup guide */}
        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-sm text-purple-700 space-y-1">
          <p className="font-medium">วิธีตั้งค่า OpenClaw Sync</p>
          <ol className="list-decimal list-inside space-y-0.5 text-purple-600">
            <li>รัน ngrok บนเครื่องที่ OpenClaw ติดตั้งอยู่</li>
            <li>กรอก ngrok URL ด้านบน แล้วนำไปใส่ใน LINE Developers Console</li>
            <li>ตั้ง OpenClaw ให้ POST มาที่ Sync Endpoint พร้อม header x-openclaw-secret</li>
            <li>เพิ่ม OPENCLAW_SYNC_SECRET ใน Vercel Environment Variables</li>
          </ol>
        </div>
      </div>

      {/* ── Facebook coming soon ───────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 opacity-50 pointer-events-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">f</div>
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
