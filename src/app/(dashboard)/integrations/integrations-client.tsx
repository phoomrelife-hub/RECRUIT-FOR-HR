"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Copy, Check, Eye, EyeOff, Trash2, FlaskConical, Bot, BotOff, Loader2 } from "lucide-react";

type BotPlatform = "LINE" | "FACEBOOK";

type Props = {
  isLineConfigured: boolean;
  webhookUrl: string;
  isFacebookConfigured: boolean;
  facebookWebhookUrl: string;
  botSwitches: Record<BotPlatform, boolean>;
};

// Global on/off for one channel's bot. Separate from the per-conversation
// takeover in /inbox: this silences the whole channel at once.
function BotPowerToggle({
  platform,
  label,
  enabled,
  onChange,
}: {
  platform: BotPlatform;
  label: string;
  enabled: boolean;
  onChange: (next: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Two-step confirm rendered inline. A native confirm() would be a blocking
  // browser modal — worse on mobile and impossible to drive from a test.
  const [confirming, setConfirming] = useState(false);

  async function toggle() {
    const next = !enabled;
    // Turning a channel OFF is the consequential direction; ask once.
    if (!next && !confirming) { setConfirming(true); return; }
    setConfirming(false);
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/integrations/bot-toggle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, enabled: next }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Record<BotPlatform, boolean>;
      // Trust the server's echo, not the optimistic guess — if two admins
      // toggle at once the UI must not show a state the DB does not hold.
      onChange(data[platform]);
    } catch {
      setError("เปลี่ยนสถานะไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        enabled ? "border-slate-200 bg-slate-50" : "border-orange-200 bg-orange-50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {enabled ? (
            <Bot className="w-5 h-5 text-indigo-600 shrink-0" />
          ) : (
            <BotOff className="w-5 h-5 text-orange-600 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">
              บอทอัตโนมัติ — {enabled ? "เปิดอยู่" : "ปิดอยู่"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {enabled
                ? `หลินตอบข้อความจาก ${label} ให้อัตโนมัติ`
                : `หลินจะไม่ตอบ ${label} — ข้อความยังเข้า Inbox ให้ HR ตอบเอง`}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`บอท ${label}`}
          data-testid={`bot-toggle-${platform.toLowerCase()}`}
          onClick={toggle}
          disabled={saving}
          className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-indigo-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
          {saving && <Loader2 className="absolute -right-6 w-4 h-4 animate-spin text-slate-400" />}
        </button>
      </div>
      {confirming && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-white border border-orange-300 px-3 py-2">
          <p className="text-xs text-slate-600">
            ปิดบอท {label}? ข้อความยังเข้า Inbox แต่บอทจะเงียบจนกว่าจะเปิดใหม่
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              data-testid={`bot-toggle-confirm-${platform.toLowerCase()}`}
              onClick={toggle}
              className="px-3 py-1 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium"
            >
              ยืนยันปิด
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-3 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

export default function IntegrationsClient({
  isLineConfigured,
  webhookUrl,
  isFacebookConfigured,
  facebookWebhookUrl,
  botSwitches,
}: Props) {
  const [bots, setBots] = useState(botSwitches);
  // ── LINE state ──
  const [lineConfigured, setLineConfigured] = useState(isLineConfigured);
  const [lineEditing, setLineEditing] = useState(false);
  const [lineSecret, setLineSecret] = useState("");
  const [lineToken, setLineToken] = useState("");
  const [showLineSecret, setShowLineSecret] = useState(false);
  const [showLineToken, setShowLineToken] = useState(false);
  const [lineSaving, setLineSaving] = useState(false);
  const [lineError, setLineError] = useState("");
  const [lineCopied, setLineCopied] = useState(false);
  const [lineTesting, setLineTesting] = useState(false);
  const [lineTestResult, setLineTestResult] = useState<{ ok: boolean; displayName?: string; basicId?: string; error?: string } | null>(null);

  // ── Facebook state ──
  const [fbConfigured, setFbConfigured] = useState(isFacebookConfigured);
  const [fbEditing, setFbEditing] = useState(false);
  const [fbToken, setFbToken] = useState("");
  const [fbSecret, setFbSecret] = useState("");
  const [fbVerify, setFbVerify] = useState("");
  const [showFbToken, setShowFbToken] = useState(false);
  const [showFbSecret, setShowFbSecret] = useState(false);
  const [showFbVerify, setShowFbVerify] = useState(false);
  const [fbSaving, setFbSaving] = useState(false);
  const [fbError, setFbError] = useState("");
  const [fbCopied, setFbCopied] = useState(false);

  // ── LINE handlers ──
  async function handleLineSave() {
    if (!lineSecret || !lineToken) { setLineError("กรุณากรอกข้อมูลให้ครบ"); return; }
    setLineSaving(true); setLineError("");
    try {
      const res = await fetch("/api/integrations/line", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelSecret: lineSecret, channelAccessToken: lineToken }),
      });
      if (!res.ok) throw new Error();
      setLineConfigured(true); setLineEditing(false); setLineSecret(""); setLineToken("");
    } catch { setLineError("บันทึกไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setLineSaving(false); }
  }

  async function handleLineDisconnect() {
    if (!confirm("ยืนยันการยกเลิกการเชื่อมต่อ LINE?")) return;
    await fetch("/api/integrations/line", { method: "DELETE" });
    setLineConfigured(false); setLineEditing(false);
  }

  async function copyLine() {
    await navigator.clipboard.writeText(webhookUrl);
    setLineCopied(true);
    setTimeout(() => setLineCopied(false), 2000);
  }

  async function testLineConnection() {
    setLineTesting(true);
    setLineTestResult(null);
    try {
      const res = await fetch("/api/integrations/line/test");
      const data = await res.json();
      setLineTestResult(data);
    } catch {
      setLineTestResult({ ok: false, error: "ไม่สามารถเชื่อมต่อได้" });
    }
    setLineTesting(false);
  }

  // ── Facebook handlers ──
  async function handleFbSave() {
    if (!fbVerify) { setFbError("กรุณากรอก Verify Token (อย่างน้อย)"); return; }
    setFbSaving(true); setFbError("");
    try {
      const res = await fetch("/api/integrations/facebook", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verifyToken: fbVerify,
          ...(fbToken ? { pageAccessToken: fbToken } : {}),
          ...(fbSecret ? { appSecret: fbSecret } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      setFbConfigured(true); setFbEditing(false); setFbToken(""); setFbSecret(""); setFbVerify("");
    } catch { setFbError("บันทึกไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setFbSaving(false); }
  }

  async function handleFbDisconnect() {
    if (!confirm("ยืนยันการยกเลิกการเชื่อมต่อ Facebook?")) return;
    await fetch("/api/integrations/facebook", { method: "DELETE" });
    setFbConfigured(false); setFbEditing(false);
  }

  async function copyFb() {
    await navigator.clipboard.writeText(facebookWebhookUrl);
    setFbCopied(true);
    setTimeout(() => setFbCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-slate-500 mt-1">Manage channel connections and webhook settings</p>
      </div>

      {/* ── LINE ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">L</div>
            <div>
              <p className="font-semibold text-slate-900">LINE Official Account</p>
              <p className="text-sm text-slate-500">รับ-ส่งข้อความจาก candidate ผ่าน LINE OA</p>
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

        <BotPowerToggle
          platform="LINE"
          label="LINE"
          enabled={bots.LINE}
          onChange={(next) => setBots((b) => ({ ...b, LINE: next }))}
        />

        <div>
          <p className="text-sm font-medium text-slate-700 mb-1.5">Webhook URL</p>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <code className="text-sm text-slate-800 flex-1 break-all select-all">{webhookUrl}</code>
            <button onClick={copyLine} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
              {lineCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Copy URL นี้ไปใส่ใน LINE Developer Console → Messaging API → Webhook URL</p>
        </div>

        {!lineEditing && !lineConfigured && (
          <button onClick={() => setLineEditing(true)}
            className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors">
            เชื่อมต่อ LINE
          </button>
        )}
        {!lineEditing && lineConfigured && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button onClick={() => setLineEditing(true)}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                แก้ไข Credentials
              </button>
              <button
                onClick={testLineConnection}
                disabled={lineTesting}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <FlaskConical className="w-4 h-4" />
                {lineTesting ? "กำลังทดสอบ..." : "ทดสอบ"}
              </button>
              <button onClick={handleLineDisconnect}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" /> ยกเลิก
              </button>
            </div>

            {lineTestResult && (
              <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm ${
                lineTestResult.ok
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}>
                {lineTestResult.ok ? (
                  <>
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Token ถูกต้อง ✓</p>
                      <p className="text-xs mt-0.5">
                        OA: <b>{lineTestResult.displayName}</b>
                        {lineTestResult.basicId && <span className="ml-1.5 opacity-70">(@{lineTestResult.basicId})</span>}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Token ไม่ถูกต้อง</p>
                      <p className="text-xs mt-0.5">{lineTestResult.error}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {lineEditing && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <PasswordField label="Channel Secret" value={lineSecret} onChange={setLineSecret}
              show={showLineSecret} onToggle={() => setShowLineSecret(!showLineSecret)} placeholder="กรอก Channel Secret" />
            <PasswordField label="Channel Access Token" value={lineToken} onChange={setLineToken}
              show={showLineToken} onToggle={() => setShowLineToken(!showLineToken)} placeholder="กรอก Channel Access Token" />
            {lineError && <p className="text-sm text-red-500">{lineError}</p>}
            <div className="flex gap-2">
              <button onClick={handleLineSave} disabled={lineSaving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {lineSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button onClick={() => { setLineEditing(false); setLineSecret(""); setLineToken(""); setLineError(""); }}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors">
                ยกเลิก
              </button>
            </div>
          </div>
        )}

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

      {/* ── Facebook Messenger ────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">f</div>
            <div>
              <p className="font-semibold text-slate-900">Facebook Messenger</p>
              <p className="text-sm text-slate-500">รับ-ส่งข้อความจาก candidate ผ่าน Facebook Page</p>
            </div>
          </div>
          {fbConfigured ? (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full">
              <CheckCircle className="w-4 h-4" /> เชื่อมต่อแล้ว
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
              <XCircle className="w-4 h-4" /> ยังไม่ได้เชื่อมต่อ
            </span>
          )}
        </div>

        <BotPowerToggle
          platform="FACEBOOK"
          label="Facebook Messenger"
          enabled={bots.FACEBOOK}
          onChange={(next) => setBots((b) => ({ ...b, FACEBOOK: next }))}
        />

        <div>
          <p className="text-sm font-medium text-slate-700 mb-1.5">Webhook URL</p>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <code className="text-sm text-slate-800 flex-1 break-all select-all">{facebookWebhookUrl}</code>
            <button onClick={copyFb} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
              {fbCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Copy URL นี้ไปใส่ใน Meta Developer Console → Webhooks → Callback URL</p>
        </div>

        {!fbEditing && !fbConfigured && (
          <button onClick={() => setFbEditing(true)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            เชื่อมต่อ Facebook
          </button>
        )}
        {!fbEditing && fbConfigured && (
          <div className="flex gap-2">
            <button onClick={() => setFbEditing(true)}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              แก้ไข Credentials
            </button>
            <button onClick={handleFbDisconnect}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" /> ยกเลิก
            </button>
          </div>
        )}
        {fbEditing && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <PasswordField label="Page Access Token (กรอกทีหลังได้)" value={fbToken} onChange={setFbToken}
              show={showFbToken} onToggle={() => setShowFbToken(!showFbToken)} placeholder="เว้นว่างไว้ก่อนได้" />
            <PasswordField label="App Secret (กรอกทีหลังได้)" value={fbSecret} onChange={setFbSecret}
              show={showFbSecret} onToggle={() => setShowFbSecret(!showFbSecret)} placeholder="เว้นว่างไว้ก่อนได้" />
            <PasswordField label="Verify Token (จำเป็น)" value={fbVerify} onChange={setFbVerify}
              show={showFbVerify} onToggle={() => setShowFbVerify(!showFbVerify)} placeholder="ตั้งค่า Verify Token (สตริงอะไรก็ได้)" />
            {fbError && <p className="text-sm text-red-500">{fbError}</p>}
            <div className="flex gap-2">
              <button onClick={handleFbSave} disabled={fbSaving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {fbSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button onClick={() => { setFbEditing(false); setFbToken(""); setFbSecret(""); setFbVerify(""); setFbError(""); }}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors">
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 space-y-1">
          <p className="font-medium">วิธีตั้งค่า</p>
          <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
            <li>ไปที่ Meta Developers → เลือก App → Add Product: Messenger</li>
            <li>Messenger Settings → Webhooks → Add Callback URL → ใส่ Webhook URL ด้านบน</li>
            <li>Verify Token ใส่ค่าเดิมที่กรอกด้านบน → Verify and Save</li>
            <li>Subscribe events: <code className="bg-blue-100 px-1 rounded">messages</code>, <code className="bg-blue-100 px-1 rounded">messaging_postbacks</code></li>
            <li>Generate Page Access Token จาก Page → กลับมากรอกด้านบน → บันทึก</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ── Shared password input component ─────────────────────────────────────────

function PasswordField({
  label, value, onChange, show, onToggle, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 mb-1.5 block">{label}</label>
      <div className="relative">
        <input type={show ? "text" : "password"} value={value}
          onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
