"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Phone,
  MessageCircle,
  ExternalLink,
  Inbox,
  FileText,
  Mail,
  MapPin,
  Users,
  TrendingUp,
  Wallet,
  Laptop,
  AlertCircle,
  Settings2,
  Trash2,
  CheckSquare,
  Zap,
  SlidersHorizontal,
  Link2,
  Tag,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { parseTier, TIER_CONFIG, type Tier } from "@/lib/experience-tier";
import { parseLocation, buildLocationOptions, matchesLocationFilter } from "@/lib/parse-location";

// ── Auto-Qualify Settings Dialog ──────────────────────────────────────────────
const ALL_TIERS: Tier[] = ["high", "mid", "low", "unspecified", "none"];

function AutoQualifySettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [expPassTiers, setExpPassTiers] = useState<Tier[]>([]);
  const [salaryMax, setSalaryMax] = useState("");
  const [salesMin, setSalesMin] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/settings/auto-qualify")
      .then((r) => r.json())
      .then((d) => {
        setExpPassTiers(d.expPassTiers ?? []);
        setSalaryMax(d.salaryMax != null ? String(d.salaryMax) : "");
        setSalesMin(d.salesMin != null ? String(d.salesMin) : "");
      })
      .catch(() => toast.error("โหลดการตั้งค่าไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [open]);

  function toggleTier(tier: Tier) {
    setExpPassTiers((prev) =>
      prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/auto-qualify", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expPassTiers,
          salaryMax: salaryMax ? parseInt(salaryMax) : null,
          salesMin: salesMin ? parseInt(salesMin) : null,
        }),
      });
      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
      toast.success("บันทึกกฎ Auto-Qualify แล้ว");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-violet-600" /> กฎ Auto-Qualify
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">ระบบจะใช้กฎนี้เมื่อกดปุ่ม ⚡ Auto-Qualify</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : (
            <>
              {/* Experience tiers */}
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">ระดับประสบการณ์ที่ ✅ ผ่าน</label>
                <p className="text-xs text-slate-400 mb-3">ที่ไม่ได้ติ๊ก = ❌ ไม่ผ่านอัตโนมัติ (ถ้าตั้งกฎนี้)</p>
                <div className="space-y-2">
                  {ALL_TIERS.map((tier) => (
                    <label key={tier} className="flex items-center gap-3 cursor-pointer group">
                      <button
                        onClick={() => toggleTier(tier)}
                        className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          expPassTiers.includes(tier) ? "bg-violet-600 border-violet-600" : "border-slate-300 group-hover:border-violet-400"
                        }`}
                      >
                        {expPassTiers.includes(tier) && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className={`inline-flex items-center rounded-full border text-xs font-semibold px-2.5 py-0.5 ${TIER_CONFIG[tier].color}`}>
                        {TIER_CONFIG[tier].label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Salary max */}
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">เงินเดือนสูงสุดที่รับได้ (บาท)</label>
                <p className="text-xs text-slate-400 mb-2">เว้นว่าง = ไม่เช็คเกณฑ์นี้</p>
                <input
                  type="number"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  placeholder="เช่น 25000"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>

              {/* Sales min */}
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">ยอดขายสูงสุดขั้นต่ำ (บาท/เดือน)</label>
                <p className="text-xs text-slate-400 mb-2">เว้นว่าง = ไม่เช็คเกณฑ์นี้</p>
                <input
                  type="number"
                  value={salesMin}
                  onChange={(e) => setSalesMin(e.target.value)}
                  placeholder="เช่น 50000"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} บันทึกกฎ
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Auto-Qualify Preview Modal ────────────────────────────────────────────────
type PreviewData = {
  autoQualify: { id: string; name: string; tier: Tier; reason: string }[];
  autoReject:  { id: string; name: string; tier: Tier; reason: string }[];
  hrReview:    { id: string; name: string; tier: Tier; reason: string }[];
};

function AutoQualifyPreviewModal({
  preview,
  onClose,
  onConfirm,
  confirming,
}: {
  preview: PreviewData;
  onClose: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const total = preview.autoQualify.length + preview.autoReject.length + preview.hrReview.length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Preview Auto-Qualify
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">ตรวจสอบก่อนดำเนินการ — {total} คนในคิว</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{preview.autoQualify.length}</p>
              <p className="text-xs text-emerald-600 mt-0.5">✅ ผ่านอัตโนมัติ</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{preview.autoReject.length}</p>
              <p className="text-xs text-red-500 mt-0.5">❌ ไม่ผ่านอัตโนมัติ</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{preview.hrReview.length}</p>
              <p className="text-xs text-amber-600 mt-0.5">👀 เหลือ HR ดู</p>
            </div>
          </div>

          {/* Reject list */}
          {preview.autoReject.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-2">❌ จะไม่ผ่าน ({preview.autoReject.length} คน)</p>
              <div className="space-y-1.5">
                {preview.autoReject.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                    <span className="text-sm text-slate-700">{e.name}</span>
                    <span className="text-xs text-red-500">{e.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Qualify list */}
          {preview.autoQualify.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-700 mb-2">✅ จะผ่าน ({preview.autoQualify.length} คน)</p>
              <div className="space-y-1.5">
                {preview.autoQualify.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                    <span className="text-sm text-slate-700">{e.name}</span>
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border ${TIER_CONFIG[e.tier].color}`}>{TIER_CONFIG[e.tier].label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>ยกเลิก</Button>
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
            onClick={onConfirm}
            disabled={confirming || (preview.autoQualify.length === 0 && preview.autoReject.length === 0)}
          >
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            ยืนยัน — ดำเนินการเลย
          </Button>
        </div>
      </div>
    </div>
  );
}

type QueueCandidate = {
  id: string;
  nickname: string | null;
  fullName: string | null;
  lineDisplayName: string | null;
  lineProfilePicUrl: string | null;
  lineUserId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  sourceChannel: string;
  notionPageId: string | null;
  experienceText: string | null;
  currentStatus: string;
  interestedPosition: { id: string; title: string } | null;
  detectedPosition: { id: string; title: string } | null;
  createdAt: Date;
};

type PropItem = {
  name: string;
  type: "text" | "url" | "tags" | "number" | "files";
  value: string | string[] | number;
};

type NotionDetail = {
  info: {
    name: string;
    phone: string;
    email: string;
    age: number | null;
    children: number | null;
    address: string;
    position: string;
    experience: string;
    maxSales: string;
    expectedSalary: string;
    equipment: string[];
    lineId: string;
  };
  allProps: PropItem[];
  qa: Array<{ question: string; answer: string }>;
};

type JobPosition = { id: string; title: string };

interface Props {
  initial: QueueCandidate[];
  positions: JobPosition[];
}

const ALL_TAB = "__all__";

// ── Message Template Dialog ───────────────────────────────────────────────────
function MessageTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<"qualify" | "interview">("qualify");

  // qualify messages
  const [qPass, setQPass] = useState("");
  const [qFail, setQFail] = useState("");
  // interview messages
  const [iPass, setIPass] = useState("");
  const [iFail, setIFail] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      fetch("/api/settings/qualify-messages").then((r) => r.json()),
      fetch("/api/settings/interview-messages").then((r) => r.json()),
    ])
      .then(([q, i]) => {
        setQPass(q.msg_pass ?? "");
        setQFail(q.msg_fail ?? "");
        setIPass(i.msg_pass ?? "");
        setIFail(i.msg_fail ?? "");
      })
      .catch(() => toast.error("โหลดข้อความไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleSave() {
    setSaving(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/settings/qualify-messages", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ msg_pass: qPass, msg_fail: qFail }),
        }),
        fetch("/api/settings/interview-messages", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ msg_pass: iPass, msg_fail: iFail }),
        }),
      ]);
      if (!r1.ok || !r2.ok) throw new Error("บันทึกไม่สำเร็จ");
      toast.success("บันทึกข้อความสำเร็จ");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">ข้อความแจ้งผล LINE</h2>
            <p className="text-xs text-slate-500 mt-0.5">ปรับแต่งข้อความที่ส่งให้ผู้สมัครเมื่อกด ผ่าน / ไม่ผ่าน</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 gap-0">
          <button
            onClick={() => setTab("qualify")}
            className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === "qualify"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            ส่งข้อความผลการพิจารณา
          </button>
          <button
            onClick={() => setTab("interview")}
            className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === "interview"
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            ส่งข้อความผลการสัมภาษณ์
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">กำลังโหลด...</span>
            </div>
          ) : tab === "qualify" ? (
            <>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-teal-700 mb-2">
                  <CheckCircle className="h-4 w-4" />
                  ข้อความเมื่อ ✅ ผ่าน
                </label>
                <textarea
                  value={qPass}
                  onChange={(e) => setQPass(e.target.value)}
                  rows={7}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none leading-relaxed"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-red-600 mb-2">
                  <XCircle className="h-4 w-4" />
                  ข้อความเมื่อ ❌ ไม่ผ่าน
                </label>
                <textarea
                  value={qFail}
                  onChange={(e) => setQFail(e.target.value)}
                  rows={7}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none leading-relaxed"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-violet-700 mb-2">
                  <CheckCircle className="h-4 w-4" />
                  ข้อความเมื่อ ✅ ผ่านสัมภาษณ์
                </label>
                <textarea
                  value={iPass}
                  onChange={(e) => setIPass(e.target.value)}
                  rows={7}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none leading-relaxed"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-red-600 mb-2">
                  <XCircle className="h-4 w-4" />
                  ข้อความเมื่อ ❌ ไม่ผ่านสัมภาษณ์
                </label>
                <textarea
                  value={iFail}
                  onChange={(e) => setIFail(e.target.value)}
                  rows={7}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none leading-relaxed"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-slate-600"
          >
            ยกเลิก
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Email Qualify Template Dialog ────────────────────────────────────────────
function EmailQualifyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [subjectPass, setSubjectPass] = useState("");
  const [subjectFail, setSubjectFail] = useState("");
  const [bodyPass, setBodyPass] = useState("");
  const [bodyFail, setBodyFail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/settings/email-qualify")
      .then((r) => r.json())
      .then((d) => {
        setSubjectPass(d.subjectPass ?? "");
        setSubjectFail(d.subjectFail ?? "");
        setBodyPass(d.bodyPass ?? "");
        setBodyFail(d.bodyFail ?? "");
      })
      .catch(() => toast.error("โหลดเทมเพลต Email ไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/email-qualify", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectPass, subjectFail, bodyPass, bodyFail }),
      });
      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
      toast.success("บันทึกเทมเพลต Email สำเร็จ");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Mail className="h-4 w-4 text-red-500" /> เทมเพลต Email แจ้งผล
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ใช้ <code className="bg-slate-100 px-1 rounded">{"{ชื่อ}"}</code> และ <code className="bg-slate-100 px-1 rounded">{"{ตำแหน่ง}"}</code> เพื่อแทรกข้อมูลผู้สมัคร
            </p>
          </div>
          <button onClick={() => onOpenChange(false)} className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">กำลังโหลด...</span>
            </div>
          ) : (
            <>
              {/* Pass */}
              <div className="space-y-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" /> เมื่อ ✅ ผ่าน
                </p>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">หัวข้ออีเมล (Subject)</label>
                  <input
                    type="text"
                    value={subjectPass}
                    onChange={(e) => setSubjectPass(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">เนื้อหาอีเมล (HTML ได้)</label>
                  <textarea
                    value={bodyPass}
                    onChange={(e) => setBodyPass(e.target.value)}
                    rows={6}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Fail */}
              <div className="space-y-3 p-4 rounded-xl bg-red-50 border border-red-100">
                <p className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" /> เมื่อ ❌ ไม่ผ่าน
                </p>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">หัวข้ออีเมล (Subject)</label>
                  <input
                    type="text"
                    value={subjectFail}
                    onChange={(e) => setSubjectFail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">เนื้อหาอีเมล (HTML ได้)</label>
                  <textarea
                    value={bodyFail}
                    onChange={(e) => setBodyFail(e.target.value)}
                    rows={6}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300 resize-none leading-relaxed"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-slate-600">ยกเลิก</Button>
          <Button
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Sheet ──────────────────────────────────────────────────────────────
function DetailSheet({
  c,
  open,
  onOpenChange,
  positions,
  onPositionChange,
}: {
  c: QueueCandidate;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  positions: JobPosition[];
  onPositionChange: (candidateId: string, pos: { id: string; title: string } | null) => void;
}) {
  const [detail, setDetail] = useState<NotionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [savingPos, setSavingPos] = useState(false);

  const name = c.fullName ?? c.nickname ?? c.lineDisplayName ?? "ไม่ระบุชื่อ";
  const tier = parseTier(c.experienceText);
  const isSalesAdmin = (c.interestedPosition?.title ?? "").toLowerCase().includes("sales admin");

  async function handleSavePosition(positionId: string) {
    if (savingPos) return;
    setSavingPos(true);
    try {
      const res = await fetch(`/api/candidates/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interestedPositionId: positionId || null }),
      });
      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
      const matched = positionId ? positions.find((p) => p.id === positionId) ?? null : null;
      onPositionChange(c.id, matched);
      toast.success(matched ? `กำหนดตำแหน่ง: ${matched.title}` : "ยกเลิกตำแหน่งแล้ว");
    } catch {
      toast.error("บันทึกตำแหน่งไม่สำเร็จ");
    } finally {
      setSavingPos(false);
    }
  }

  // fetch on first open
  useEffect(() => {
    if (!open || detail || loadingDetail) return;
    setLoadingDetail(true);
    setDetailError(null);
    fetch(`/api/candidates/${c.id}/notion-detail`)
      .then(async (res) => {
        if (res.status === 404) {
          setDetailError("ไม่มีข้อมูลใน Notion สำหรับผู้สมัครนี้");
        } else if (!res.ok) {
          throw new Error("โหลดข้อมูลไม่สำเร็จ");
        } else {
          setDetail(await res.json());
        }
      })
      .catch((err) => setDetailError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด"))
      .finally(() => setLoadingDetail(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto p-0"
      >
        {/* ── Header ── */}
        <SheetHeader className="sticky top-0 z-10 bg-white border-b px-6 py-4 gap-2">
          <div className="flex items-center gap-3 pr-8">
            {c.lineProfilePicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.lineProfilePicUrl}
                alt={name}
                className="h-10 w-10 rounded-full object-cover border-2 border-green-200 shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-200 shrink-0">
                <span className="text-slate-500 font-semibold text-sm">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <SheetTitle className="text-base font-bold text-slate-900 leading-tight">
                {name}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {/* Position selector — always visible, editable */}
                <div className="relative">
                  <select
                    value={c.interestedPosition?.id ?? ""}
                    onChange={(e) => handleSavePosition(e.target.value)}
                    disabled={savingPos}
                    className={`text-xs rounded-md border px-2 py-0.5 pr-5 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors ${
                      c.interestedPosition
                        ? "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        : "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400"
                    } disabled:opacity-50`}
                  >
                    <option value="">— ยังไม่ระบุตำแหน่ง —</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-[9px]">
                    {savingPos ? "⏳" : "▾"}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border text-[10px] font-semibold px-2 py-0.5 ${TIER_CONFIG[tier].color}`}
                >
                  {TIER_CONFIG[tier].label}
                </span>
                {c.lineUserId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold px-1.5 py-0.5">
                    <MessageCircle className="h-2.5 w-2.5" /> LINE
                  </span>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* ── Body ── */}
        <div className="px-6 py-4 space-y-6">

          {/* Quick contact from DB */}
          <Section title="ข้อมูลติดต่อ (จากระบบ)">
            <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="เบอร์โทร" value={c.phone} />
            {c.lineUserId && (
              <InfoRow icon={<MessageCircle className="h-3.5 w-3.5" />} label="LINE User ID" value={c.lineUserId} />
            )}
            {c.experienceText && (
              <InfoRow icon={<TrendingUp className="h-3.5 w-3.5" />} label="ประสบการณ์" value={c.experienceText} />
            )}
            <div className="mt-2">
              <Link href={`/candidates/${c.id}`} target="_blank">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />
                  เปิดโปรไฟล์เต็ม
                </Button>
              </Link>
            </div>
          </Section>

          {/* Notion detail */}
          {loadingDetail && (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">กำลังโหลดข้อมูลจาก Notion...</span>
            </div>
          )}

          {detailError && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {detailError}
            </div>
          )}

          {detail && isSalesAdmin && (
            <>
              {/* Contact from Notion — Sales Admin */}
              <Section title="ข้อมูลส่วนตัว">
                <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="เบอร์โทร" value={detail.info.phone} />
                <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="อีเมล" value={detail.info.email} />
                <InfoRow icon={<span className="text-[10px] font-bold text-slate-500">อายุ</span>} label="อายุ" value={detail.info.age != null ? `${detail.info.age} ปี` : null} />
                <InfoRow icon={<Users className="h-3.5 w-3.5" />} label="บุตร" value={detail.info.children != null ? `${detail.info.children} คน` : null} />
                <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="ที่อยู่" value={detail.info.address} />
                {detail.info.lineId && (
                  <InfoRow icon={<MessageCircle className="h-3.5 w-3.5" />} label="LINE ID" value={detail.info.lineId} />
                )}
              </Section>

              {/* Sales info */}
              {(detail.info.experience || detail.info.maxSales || detail.info.expectedSalary || detail.info.equipment.length > 0) && (
                <Section title="ข้อมูลการขาย">
                  <InfoRow icon={<TrendingUp className="h-3.5 w-3.5" />} label="ประสบการณ์ขาย" value={detail.info.experience} />
                  <InfoRow icon={<TrendingUp className="h-3.5 w-3.5" />} label="ยอดขายสูงสุด/เดือน" value={detail.info.maxSales} />
                  <InfoRow icon={<Wallet className="h-3.5 w-3.5" />} label="รายได้ที่คาดหวัง" value={detail.info.expectedSalary} />
                  {detail.info.equipment.length > 0 && (
                    <div className="flex gap-2 py-1">
                      <span className="shrink-0 mt-0.5 text-slate-400">
                        <Laptop className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-slate-500 block mb-1">อุปกรณ์ที่มี</span>
                        <div className="flex flex-wrap gap-1">
                          {detail.info.equipment.map((eq) => (
                            <span key={eq} className="inline-flex rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5">
                              {eq}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {/* Deep Q&A */}
              {detail.qa.length > 0 && (
                <Section title={`คำถามเชิงลึก (${detail.qa.length} ข้อ)`}>
                  <div className="space-y-4 mt-1">
                    {detail.qa.map((item, i) => (
                      <div key={i} className="space-y-1">
                        <p className="text-xs font-semibold text-slate-700 leading-snug">
                          {i + 1}. {item.question}
                        </p>
                        <p className={`text-xs leading-relaxed pl-3 border-l-2 ${item.answer === "(ไม่ได้ตอบ)" ? "text-slate-400 border-slate-200 italic" : "text-slate-600 border-blue-200"}`}>
                          {item.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {detail && !isSalesAdmin && (
            <>
              {/* Generic Notion props — all other positions */}
              {detail.allProps.length > 0 && (
                <Section title="ข้อมูลจาก Notion">
                  {detail.allProps.map((prop) => {
                    if (prop.type === "url") {
                      return (
                        <div key={prop.name} className="flex items-start gap-2 py-1">
                          <span className="shrink-0 mt-0.5 text-slate-400"><Link2 className="h-3.5 w-3.5" /></span>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-slate-400 block">{prop.name}</span>
                            <a
                              href={prop.value as string}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline break-all"
                            >
                              {prop.value as string}
                            </a>
                          </div>
                        </div>
                      );
                    }
                    if (prop.type === "files") {
                      return (
                        <div key={prop.name} className="flex items-start gap-2 py-1">
                          <span className="shrink-0 mt-0.5 text-slate-400"><FileText className="h-3.5 w-3.5" /></span>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-slate-400 block">{prop.name}</span>
                            {(prop.value as string[]).map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                {i === 0 ? "เปิดไฟล์" : `ไฟล์ ${i + 1}`}
                              </a>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (prop.type === "tags") {
                      return (
                        <div key={prop.name} className="flex items-start gap-2 py-1">
                          <span className="shrink-0 mt-0.5 text-slate-400"><Tag className="h-3.5 w-3.5" /></span>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-slate-400 block">{prop.name}</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {(prop.value as string[]).map((v) => (
                                <span key={v} className="inline-flex rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5">
                                  {v}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    // text or number
                    const displayVal =
                      typeof prop.value === "number"
                        ? prop.value.toLocaleString()
                        : (prop.value as string);
                    return (
                      <InfoRow
                        key={prop.name}
                        icon={<span className="h-3.5 w-3.5 inline-block" />}
                        label={prop.name}
                        value={displayVal}
                      />
                    );
                  })}
                </Section>
              )}

              {/* Q&A blocks — available for all positions */}
              {detail.qa.length > 0 && (
                <Section title={`คำถาม-คำตอบ (${detail.qa.length} ข้อ)`}>
                  <div className="space-y-4 mt-1">
                    {detail.qa.map((item, i) => (
                      <div key={i} className="space-y-1">
                        <p className="text-xs font-semibold text-slate-700 leading-snug">
                          {i + 1}. {item.question}
                        </p>
                        <p className={`text-xs leading-relaxed pl-3 border-l-2 ${item.answer === "(ไม่ได้ตอบ)" ? "text-slate-400 border-slate-200 italic" : "text-slate-600 border-blue-200"}`}>
                          {item.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</h3>
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2 space-y-1">
        {children}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="shrink-0 mt-0.5 text-slate-400">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-slate-400 block">{label}</span>
        <span className="text-xs text-slate-700 break-words">{value}</span>
      </div>
    </div>
  );
}

// ── Candidate Row ─────────────────────────────────────────────────────────────
function CandidateRow({
  c,
  showTier,
  loading,
  selected,
  onToggle,
  onQualify,
  positions,
  onPositionChange,
}: {
  c: QueueCandidate;
  showTier: boolean;
  loading: Record<string, "pass" | "fail">;
  selected: boolean;
  onToggle: (id: string) => void;
  onQualify: (c: QueueCandidate, result: "pass" | "fail") => void;
  positions: JobPosition[];
  onPositionChange: (candidateId: string, pos: { id: string; title: string } | null) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const name = c.fullName ?? c.nickname ?? c.lineDisplayName ?? "ไม่ระบุชื่อ";
  const isLoading = !!loading[c.id];
  const tier: Tier | null = showTier ? parseTier(c.experienceText) : null;

  const avatar = c.lineProfilePicUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.lineProfilePicUrl} alt={name} className="h-10 w-10 rounded-full object-cover border-2 border-green-200 shrink-0" />
  ) : (
    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-200 shrink-0">
      <span className="text-slate-500 font-semibold text-sm">{name.charAt(0).toUpperCase()}</span>
    </div>
  );

  const badges = (
    <>
      {c.lineUserId && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold px-1.5 py-0.5">
          <MessageCircle className="h-2.5 w-2.5" /> LINE
        </span>
      )}
      {c.sourceChannel === "JOBBKK" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold px-1.5 py-0.5">
          <Mail className="h-2.5 w-2.5" /> JobBKK
        </span>
      )}
      {c.sourceChannel === "JOBTHAI" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 text-[10px] font-semibold px-1.5 py-0.5">
          <Mail className="h-2.5 w-2.5" /> JobThai
        </span>
      )}
      {tier && (
        <span className={`inline-flex items-center rounded-full border text-[10px] font-semibold px-2 py-0.5 ${TIER_CONFIG[tier].color}`}>
          {TIER_CONFIG[tier].label}
        </span>
      )}
    </>
  );

  const subInfo = (
    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
      {c.phone && (
        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>
      )}
      {!c.lineUserId && c.email && (
        <span className="flex items-center gap-1 text-slate-400"><Mail className="h-3 w-3" />{c.email}</span>
      )}
      {showTier && c.experienceText && (
        <span className="text-slate-400 truncate max-w-[260px]" title={c.experienceText}>
          {c.experienceText.length > 50 ? c.experienceText.slice(0, 50) + "…" : c.experienceText}
        </span>
      )}
      {!showTier && c.interestedPosition && (
        <span className="text-slate-400">{c.interestedPosition.title}</span>
      )}
      {!showTier && !c.interestedPosition && c.detectedPosition && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-medium px-2 py-0.5">
          💡 น่าจะเป็น: {c.detectedPosition.title}
        </span>
      )}
    </div>
  );

  const checkbox = (
    <button
      onClick={() => onToggle(c.id)}
      className={`shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
        selected ? "bg-blue-600 border-blue-600" : "border-slate-300 hover:border-blue-400"
      }`}
      aria-label={selected ? "ยกเลิกการเลือก" : "เลือก"}
    >
      {selected && (
        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );

  return (
    <>
      {/* ── Mobile card ── */}
      <div className={`sm:hidden rounded-xl border bg-white shadow-sm transition-colors ${selected ? "border-blue-400 bg-blue-50/40" : "border-slate-200"}`}>
        <div className="flex items-start gap-3 px-3 pt-3 pb-2">
          {checkbox}
          {avatar}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 text-sm">{name}</span>
              {badges}
            </div>
            {subInfo}
          </div>
          {/* Detail + profile icons */}
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setSheetOpen(true)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
              title="รายละเอียด"
            >
              <FileText className="h-4 w-4" />
            </button>
            <Link href={`/candidates/${c.id}`} target="_blank">
              <button className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors">
                <ExternalLink className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
        {/* Pass / Fail — full-width tap targets */}
        <div className="flex border-t border-slate-100">
          <button
            disabled={isLoading}
            onClick={() => onQualify(c, "pass")}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-50 active:bg-teal-100 border-r border-slate-100 rounded-bl-xl transition-colors disabled:opacity-50"
          >
            {loading[c.id] === "pass" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            ผ่าน
          </button>
          <button
            disabled={isLoading}
            onClick={() => onQualify(c, "fail")}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 active:bg-red-100 rounded-br-xl transition-colors disabled:opacity-50"
          >
            {loading[c.id] === "fail" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            ไม่ผ่าน
          </button>
        </div>
      </div>

      {/* ── Desktop row ── */}
      <div className={`hidden sm:flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm hover:border-slate-300 transition-colors ${selected ? "border-blue-400 bg-blue-50/40" : "border-slate-200"}`}>
        {checkbox}
        <div className="shrink-0">{avatar}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{name}</span>
            {badges}
          </div>
          {subInfo}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1 text-slate-600 border-slate-200" onClick={() => setSheetOpen(true)}>
            <FileText className="h-3.5 w-3.5" />รายละเอียด
          </Button>
          <Link href={`/candidates/${c.id}`} target="_blank">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white h-8 px-3 text-xs" disabled={isLoading} onClick={() => onQualify(c, "pass")}>
            {loading[c.id] === "pass" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5 mr-1" />ผ่าน</>}
          </Button>
          <Button size="sm" variant="destructive" className="h-8 px-3 text-xs" disabled={isLoading} onClick={() => onQualify(c, "fail")}>
            {loading[c.id] === "fail" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1" />ไม่ผ่าน</>}
          </Button>
        </div>
      </div>

      <DetailSheet c={c} open={sheetOpen} onOpenChange={setSheetOpen} positions={positions} onPositionChange={onPositionChange} />
    </>
  );
}

// ── Location Combobox ─────────────────────────────────────────────────────────
function LocationCombobox({
  groups,
  value,
  onChange,
}: {
  groups: import("@/lib/parse-location").LocationGroup[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allOptions = groups.flatMap((g) =>
    g.options.map((o) => ({ ...o, group: g.group }))
  );

  const filtered = search.trim()
    ? allOptions.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.group.toLowerCase().includes(search.toLowerCase())
      )
    : allOptions;

  const selectedLabel = allOptions.find((o) => o.value === value)?.label ?? "";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((v) => !v); setSearch(""); }}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors min-w-[140px] max-w-[200px] ${
          value
            ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
        }`}
      >
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate flex-1 text-left">
          {value ? selectedLabel : "ทุกพื้นที่"}
        </span>
        {value ? (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="text-blue-400 hover:text-blue-700 ml-1"
          >
            <X className="h-3 w-3" />
          </span>
        ) : (
          <span className="text-slate-400 text-[9px]">▾</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg w-56 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาเขต / จังหวัด..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto py-1">
            {/* All option */}
            {!search && (
              <button
                onClick={() => { onChange(""); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  !value ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                ทุกพื้นที่
              </button>
            )}

            {/* Grouped options */}
            {search ? (
              filtered.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">ไม่พบ</p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between ${
                      value === o.value ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{o.label}</span>
                    <span className="text-[10px] text-slate-400">{o.group}</span>
                  </button>
                ))
              )
            ) : (
              groups.map((g) => (
                <div key={g.group}>
                  <p className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
                    {g.group}
                  </p>
                  {g.options.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        value === o.value ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function ReviewClient({ initial, positions }: Props) {
  const [queue, setQueue] = useState<QueueCandidate[]>(initial);
  const [loading, setLoading] = useState<Record<string, "pass" | "fail">>({});
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "LINE" | "EMAIL">("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [emailQualifyOpen, setEmailQualifyOpen] = useState(false);
  const [aqSettingsOpen, setAqSettingsOpen] = useState(false);
  const [aqPreview, setAqPreview] = useState<PreviewData | null>(null);
  const [aqRunning, setAqRunning] = useState(false);
  const [aqLoading, setAqLoading] = useState(false);
  const [aqConfigured, setAqConfigured] = useState<boolean | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [fullBackfillLoading, setFullBackfillLoading] = useState(false);
  const [bulkPositionId, setBulkPositionId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [addressBackfillLoading, setAddressBackfillLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings/auto-qualify")
      .then((r) => r.json())
      .then((d) => setAqConfigured((d.expPassTiers ?? []).length > 0))
      .catch(() => setAqConfigured(null));
  }, []);

  // Build tabs: all job positions (always shown) + "ไม่ระบุตำแหน่ง" if any
  const tabs = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const c of queue) {
      const key = c.interestedPosition?.title ?? "ไม่ระบุตำแหน่ง";
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }
    const named: [string, number][] = positions.map((p) => [p.title, countMap.get(p.title) ?? 0]);
    const noneCount = countMap.get("ไม่ระบุตำแหน่ง") ?? 0;
    return [
      ...named,
      ...(noneCount > 0 ? [["ไม่ระบุตำแหน่ง", noneCount] as [string, number]] : []),
    ];
  }, [queue, positions]);

  const isSalesAdmin =
    activeTab !== ALL_TAB && activeTab.toLowerCase().includes("sales admin");

  const EMAIL_SOURCES = ["JOBBKK", "JOBTHAI"];

  const filtered = useMemo(() => {
    let list =
      activeTab === ALL_TAB
        ? queue
        : queue.filter(
            (c) => (c.interestedPosition?.title ?? "ไม่ระบุตำแหน่ง") === activeTab
          );
    // Apply source filter
    if (sourceFilter === "LINE") {
      list = list.filter((c) => !EMAIL_SOURCES.includes(c.sourceChannel));
    } else if (sourceFilter === "EMAIL") {
      list = list.filter((c) => EMAIL_SOURCES.includes(c.sourceChannel));
    }
    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((c) => {
        const name = (c.fullName ?? c.nickname ?? c.lineDisplayName ?? "").toLowerCase();
        const phone = (c.phone ?? "").toLowerCase();
        const email = (c.email ?? "").toLowerCase();
        return name.includes(q) || phone.includes(q) || email.includes(q);
      });
    }
    // Apply location filter
    if (locationFilter) {
      list = list.filter((c) => matchesLocationFilter(c.address, locationFilter));
    }
    if (isSalesAdmin) {
      return [...list].sort((a, b) => {
        const ta = TIER_CONFIG[parseTier(a.experienceText)].order;
        const tb = TIER_CONFIG[parseTier(b.experienceText)].order;
        if (ta !== tb) return ta - tb;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, activeTab, isSalesAdmin, sourceFilter, searchQuery, locationFilter]);

  // Location options from all candidates with address
  const locationGroups = useMemo(() => buildLocationOptions(queue), [queue]);
  const hasAddressData = queue.some((c) => c.address);

  // IDs visible in current tab
  const filteredIds = useMemo(() => filtered.map((c) => c.id), [filtered]);
  const allCurrentSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someCurrentSelected = filteredIds.some((id) => selected.has(id));

  // Clear selection when tab changes
  useEffect(() => {
    setSelected(new Set());
  }, [activeTab]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allCurrentSelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [allCurrentSelected, filteredIds]);

  const handlePositionChange = useCallback(
    (candidateId: string, pos: { id: string; title: string } | null) => {
      setQueue((prev) =>
        prev.map((c) =>
          c.id === candidateId ? { ...c, interestedPosition: pos } : c
        )
      );
    },
    []
  );

  async function handleQualify(candidate: QueueCandidate, result: "pass" | "fail") {
    setLoading((prev) => ({ ...prev, [candidate.id]: result }));
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/qualify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");

      setQueue((prev) => prev.filter((c) => c.id !== candidate.id));
      setSelected((prev) => { const n = new Set(prev); n.delete(candidate.id); return n; });

      const remaining = queue.filter(
        (c) =>
          c.id !== candidate.id &&
          (c.interestedPosition?.title ?? "ไม่ระบุตำแหน่ง") === activeTab
      );
      if (remaining.length === 0 && activeTab !== ALL_TAB) setActiveTab(ALL_TAB);

      const label = result === "pass" ? "✅ ผ่าน" : "❌ ไม่ผ่าน";
      const name =
        candidate.fullName ?? candidate.nickname ?? candidate.lineDisplayName ?? "ไม่ระบุ";
      const msgs: string[] = [];
      if (data.lineSent) msgs.push("ส่ง LINE แล้ว");
      if (data.emailSent) msgs.push("ส่ง Email แล้ว");
      if (data.notionPatched) msgs.push("อัปเดต Notion แล้ว");

      toast.success(`${name} — ${label}`, {
        description: msgs.join(" · ") || undefined,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading((prev) => {
        const next = { ...prev };
        delete next[candidate.id];
        return next;
      });
    }
  }

  async function handleAutoQualifyPreview() {
    setAqLoading(true);
    try {
      const res = await fetch("/api/candidates/auto-qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      setAqPreview(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setAqLoading(false);
    }
  }

  async function handleAutoQualifyRun() {
    setAqRunning(true);
    try {
      const res = await fetch("/api/candidates/auto-qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");

      // Remove processed candidates from queue
      const processedIds = new Set([
        ...(aqPreview?.autoQualify.map((e) => e.id) ?? []),
        ...(aqPreview?.autoReject.map((e) => e.id) ?? []),
      ]);
      setQueue((prev) => prev.filter((c) => !processedIds.has(c.id)));
      setSelected(new Set());
      setAqPreview(null);

      toast.success(`Auto-Qualify เสร็จสิ้น`, {
        description: `✅ ผ่าน ${data.qualifyDone} · ❌ ไม่ผ่าน ${data.rejectDone} · 👀 HR ดูต่อ ${data.hrReview}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setAqRunning(false);
    }
  }

  async function handleBackfillPositions() {
    setBackfillLoading(true);
    try {
      const res = await fetch("/api/admin/backfill-positions", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");

      if (data.fixed === 0) {
        toast.info("ไม่พบข้อมูลตำแหน่งเพิ่มเติม", {
          description: `ตรวจ ${data.scanned} คน — ไม่มีข้อมูลในแชทเพียงพอ`,
        });
        return;
      }

      toast.success(`ซ่อมตำแหน่งสำเร็จ ${data.fixed} คน`, {
        description: "กำลังโหลดหน้าใหม่...",
      });
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBackfillLoading(false);
    }
  }

  async function handleFullBackfill() {
    setFullBackfillLoading(true);
    try {
      const res = await fetch("/api/admin/backfill-positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allStatuses: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");

      if (data.fixed === 0) {
        toast.info("ไม่พบข้อมูลตำแหน่งเพิ่มเติม", {
          description: `ตรวจทั้งหมด ${data.scanned} คน — ไม่มีข้อมูลในแชทเพียงพอ`,
        });
        return;
      }

      toast.success(`อัปเดตตำแหน่งทั้งหมด ${data.fixed} คน`, {
        description: `จาก SYSTEM: ${data.bySource?.system ?? 0} คน · จากแชท: ${data.bySource?.candidate ?? 0} คน`,
        duration: 5000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setFullBackfillLoading(false);
    }
  }

  async function handleBulkAssignPosition() {
    const ids = Array.from(selected);
    if (!ids.length || !bulkPositionId) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/candidates/bulk-assign-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, positionId: bulkPositionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");

      const pos = positions.find((p) => p.id === bulkPositionId);
      // Update queue state — assign position to all selected candidates
      setQueue((prev) =>
        prev.map((c) =>
          selected.has(c.id) ? { ...c, interestedPosition: pos ?? null } : c
        )
      );
      setSelected(new Set());
      setBulkPositionId("");
      toast.success(`กำหนดตำแหน่งสำเร็จ ${data.updated} คน`, {
        description: `→ ${data.position}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleAddressBackfill() {
    setAddressBackfillLoading(true);
    try {
      const res = await fetch("/api/admin/backfill-address", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      if (data.updated === 0) {
        toast.info("ไม่มีข้อมูลที่อยู่เพิ่มเติม", { description: "อาจไม่มี Notion page หรืออัปเดตแล้ว" });
      } else {
        toast.success(`ดึงที่อยู่สำเร็จ ${data.updated} คน`, { description: "กำลังโหลดหน้าใหม่..." });
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setAddressBackfillLoading(false);
    }
  }

  async function handleBulkQualify(result: "pass" | "fail") {
    const ids = Array.from(selected);
    if (!ids.length) return;

    setBulkLoading(true);
    try {
      const res = await fetch("/api/candidates/bulk-qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");

      setQueue((prev) => prev.filter((c) => !ids.includes(c.id)));
      setSelected(new Set());

      const label = result === "pass" ? "✅ ผ่าน" : "❌ ไม่ผ่าน";
      toast.success(`${data.succeeded} คน — ${label}`, {
        description: data.failed > 0 ? `ไม่สำเร็จ ${data.failed} คน` : undefined,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBulkLoading(false);
    }
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Inbox className="h-12 w-12 mb-3 text-slate-300" />
        <p className="text-lg font-medium text-slate-500">ไม่มีใบสมัครที่รอพิจารณา</p>
        <p className="text-sm mt-1">เมื่อมีผู้สมัครใหม่จะแสดงที่นี่</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Unlinked position banner ── */}
      {queue.some((c) => !c.interestedPosition) && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 mb-2">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
            <p className="text-sm text-blue-800">
              <span className="font-semibold">
                พบ {queue.filter((c) => !c.interestedPosition).length} คน
              </span>
              {" "}ที่ยังไม่ระบุตำแหน่ง — ระบบจะพยายามดึงจากประวัติแชทอัตโนมัติ
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleBackfillPositions}
              disabled={backfillLoading || fullBackfillLoading}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 border border-blue-300 bg-white hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              {backfillLoading ? (
                <><Loader2 className="h-3 w-3 animate-spin" />กำลังซ่อม...</>
              ) : (
                <>🔧 ซ่อมในคิวนี้</>
              )}
            </button>
            <button
              onClick={handleFullBackfill}
              disabled={backfillLoading || fullBackfillLoading}
              className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 border border-violet-300 bg-white hover:bg-violet-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              {fullBackfillLoading ? (
                <><Loader2 className="h-3 w-3 animate-spin" />กำลังสแกน...</>
              ) : (
                <>🔍 สแกนทั้งหมด 725 คน</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Auto-Qualify warning banner ── */}
      {aqConfigured === false && queue.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Auto-Qualify ยังไม่ได้ตั้งกฎ</span>
              {" — "}มี {queue.length} คนรอในคิว ตั้งกฎเพื่อให้ระบบคัดกรองอัตโนมัติ
            </p>
          </div>
          <button
            onClick={() => setAqSettingsOpen(true)}
            className="shrink-0 text-xs font-semibold text-amber-700 border border-amber-300 bg-white hover:bg-amber-100 rounded-lg px-3 py-1.5 transition-colors"
          >
            ตั้งกฎเดี๋ยวนี้
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* ── Tab bar + toolbar ── */}
        <div className="flex items-center gap-2">
          {/* Scrollable tab strip */}
          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none min-w-0">
            <button
              onClick={() => setActiveTab(ALL_TAB)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium border transition-colors ${
                activeTab === ALL_TAB
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800"
              }`}
            >
              ทั้งหมด
              <span className={`rounded-full px-1.5 py-0 text-[10px] font-bold ${activeTab === ALL_TAB ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                {queue.length}
              </span>
            </button>
            {tabs.map(([title, count]) => {
              const isActive = activeTab === title;
              const isSA = title.toLowerCase().includes("sales admin");
              return (
                <button
                  key={title}
                  onClick={() => setActiveTab(title)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium border transition-colors ${
                    isActive
                      ? isSA ? "bg-blue-600 text-white border-blue-600" : "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800"
                  }`}
                >
                  {title}
                  <span className={`rounded-full px-1.5 py-0 text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Toolbar — icon+label on desktop, icon-only on mobile */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleAutoQualifyPreview}
              disabled={aqLoading}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
              title="Auto-Qualify"
            >
              {aqLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              <span className="hidden sm:inline">Auto-Qualify</span>
            </button>
            <button
              onClick={() => setAqSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-colors"
              title="ตั้งกฎ Auto-Qualify"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">กฎ</span>
            </button>
            <button
              onClick={() => setTemplateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-colors"
              title="ตั้งค่าข้อความแจ้งผล LINE"
            >
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">LINE</span>
            </button>
            <button
              onClick={() => setEmailQualifyOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
              title="ตั้งค่า Email แจ้งผล JobBKK/JobThai"
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </button>
          </div>
        </div>

        {/* ── Source filter toggle ── */}
        {(() => {
          const lineCount = queue.filter((c) => !["JOBBKK","JOBTHAI"].includes(c.sourceChannel)).length;
          const emailCount = queue.filter((c) => ["JOBBKK","JOBTHAI"].includes(c.sourceChannel)).length;
          if (emailCount === 0) return null; // no email candidates → hide toggle
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 mr-1">แหล่งที่มา:</span>
              {(["ALL", "LINE", "EMAIL"] as const).map((f) => {
                const labels: Record<typeof f, string> = { ALL: "ทั้งหมด", LINE: "📱 LINE", EMAIL: "📧 Email" };
                const counts: Record<typeof f, number> = { ALL: queue.length, LINE: lineCount, EMAIL: emailCount };
                return (
                  <button
                    key={f}
                    onClick={() => setSourceFilter(f)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      sourceFilter === f
                        ? f === "EMAIL"
                          ? "bg-red-500 text-white border-red-500"
                          : f === "LINE"
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-slate-700 text-white border-slate-700"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    {labels[f]}
                    <span className={`rounded-full px-1.5 text-[10px] font-bold ${sourceFilter === f ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
                      {counts[f]}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* ── Search + Location filter ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อ, เบอร์โทร, อีเมล..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Location combobox */}
          <LocationCombobox
            groups={locationGroups}
            value={locationFilter}
            onChange={setLocationFilter}
          />

          {/* Sync address button */}
          <button
            onClick={handleAddressBackfill}
            disabled={addressBackfillLoading}
            className="shrink-0 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors px-1"
            title={hasAddressData ? "อัปเดตที่อยู่จาก Notion" : "ดึงที่อยู่จาก Notion"}
          >
            {addressBackfillLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>🔄</span>}
          </button>
        </div>

        {/* ── Sales Admin tier legend + select-all ── */}
        {isSalesAdmin && (
          <div className="flex items-center gap-2 flex-wrap p-3 rounded-xl bg-blue-50 border border-blue-100">
            <span className="text-xs font-medium text-blue-700 mr-1">ระดับประสบการณ์ :</span>
            {(Object.entries(TIER_CONFIG) as [Tier, (typeof TIER_CONFIG)[Tier]][]).map(([key, cfg]) => (
              <span key={key} className={`inline-flex items-center rounded-full border text-[10px] font-semibold px-2 py-0.5 ${cfg.color}`}>
                {cfg.label}
              </span>
            ))}
          </div>
        )}

        {/* ── Select-all bar ── */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={toggleAll}
              className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                allCurrentSelected
                  ? "bg-blue-600 border-blue-600"
                  : someCurrentSelected
                  ? "bg-blue-200 border-blue-400"
                  : "border-slate-300 hover:border-blue-400"
              }`}
              aria-label="เลือกทั้งหมด"
            >
              {allCurrentSelected && (
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {someCurrentSelected && !allCurrentSelected && (
                <div className="h-2 w-2 rounded-sm bg-blue-600" />
              )}
            </button>
            <span className="text-xs text-slate-500">
              {someCurrentSelected
                ? `เลือกแล้ว ${selected.size} คน`
                : `เลือกทั้งหมด ${filtered.length} คน`}
            </span>
          </div>
        )}

        {/* ── Candidate list ── */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              {searchQuery.trim()
                ? `ไม่พบผู้สมัครที่ตรงกับ "${searchQuery}"`
                : "ไม่มีรายการในตำแหน่งนี้"}
            </div>
          ) : (
            filtered.map((c) => (
              <CandidateRow
                key={c.id}
                c={c}
                showTier={isSalesAdmin}
                loading={loading}
                selected={selected.has(c.id)}
                onToggle={toggleOne}
                onQualify={handleQualify}
                positions={positions}
                onPositionChange={handlePositionChange}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Bulk action floating bar ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-3 bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex-wrap max-w-2xl">
            <CheckSquare className="h-4 w-4 text-blue-400 shrink-0" />
            <span className="text-sm font-medium">เลือก {selected.size} คน</span>
            <div className="w-px h-5 bg-slate-600" />

            {/* ── Bulk position assign (shows when unlinked candidates selected) ── */}
            {Array.from(selected).some((id) => !queue.find((c) => c.id === id)?.interestedPosition) && (
              <>
                <div className="flex items-center gap-1.5">
                  <select
                    value={bulkPositionId}
                    onChange={(e) => setBulkPositionId(e.target.value)}
                    className="text-xs bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-blue-400 appearance-none pr-6"
                    style={{ backgroundImage: "none" }}
                  >
                    <option value="">📌 กำหนดตำแหน่ง...</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-500 text-white h-8 px-3 text-xs font-semibold disabled:opacity-40"
                    disabled={!bulkPositionId || bulkLoading}
                    onClick={handleBulkAssignPosition}
                  >
                    {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "ยืนยัน"}
                  </Button>
                </div>
                <div className="w-px h-5 bg-slate-600" />
              </>
            )}

            <Button
              size="sm"
              className="bg-teal-500 hover:bg-teal-400 text-white h-8 px-4 text-xs font-semibold"
              disabled={bulkLoading}
              onClick={() => handleBulkQualify("pass")}
            >
              {bulkLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  ผ่านทั้งหมด
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 px-4 text-xs font-semibold bg-red-500 hover:bg-red-400"
              disabled={bulkLoading}
              onClick={() => handleBulkQualify("fail")}
            >
              {bulkLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  ไม่ผ่านทั้งหมด
                </>
              )}
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-slate-400 hover:text-white text-xs ml-1 transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* ── Message template dialog ── */}
      <MessageTemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} />

      {/* ── Email qualify template dialog ── */}
      <EmailQualifyDialog open={emailQualifyOpen} onOpenChange={setEmailQualifyOpen} />

      {/* ── Auto-Qualify settings dialog ── */}
      <AutoQualifySettingsDialog
        open={aqSettingsOpen}
        onOpenChange={setAqSettingsOpen}
        onSaved={() => {}}
      />

      {/* ── Auto-Qualify preview modal ── */}
      {aqPreview && (
        <AutoQualifyPreviewModal
          preview={aqPreview}
          onClose={() => setAqPreview(null)}
          onConfirm={handleAutoQualifyRun}
          confirming={aqRunning}
        />
      )}
    </>
  );
}
