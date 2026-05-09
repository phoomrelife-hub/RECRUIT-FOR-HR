"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  ChevronRight,
  Loader2,
  MessageCircle,
  Phone,
  Send,
  Trophy,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

type ShortlistCandidate = {
  id: string;
  fullName: string | null;
  nickname: string | null;
  lineDisplayName: string | null;
  lineProfilePicUrl: string | null;
  lineUserId: string | null;
  phone: string | null;
  currentStatus: string;
  interestedPosition: { title: string } | null;
};

interface Props {
  qualified: ShortlistCandidate[];
  scheduled: ShortlistCandidate[];
  interviewed: ShortlistCandidate[];
  passed: ShortlistCandidate[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getName(c: ShortlistCandidate) {
  return c.fullName ?? c.nickname ?? c.lineDisplayName ?? "ไม่ระบุชื่อ";
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ c, size = "sm" }: { c: ShortlistCandidate; size?: "sm" | "md" }) {
  const name = getName(c);
  const dim = size === "md" ? "h-10 w-10" : "h-8 w-8";
  const text = size === "md" ? "text-sm" : "text-xs";
  return c.lineProfilePicUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={c.lineProfilePicUrl}
      alt={name}
      className={`${dim} rounded-full object-cover border border-slate-200 shrink-0`}
    />
  ) : (
    <div
      className={`${dim} rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0`}
    >
      <span className={`${text} font-semibold text-slate-500`}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

// ── Schedule Interview Dialog ─────────────────────────────────────────────────

function ScheduleDialog({
  candidate,
  open,
  onOpenChange,
  onScheduled,
}: {
  candidate: ShortlistCandidate | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onScheduled: (id: string) => void;
}) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidate) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/schedule-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startTime, location: location || undefined, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      toast.success(
        data.lineSent
          ? "นัดสัมภาษณ์แล้ว · ส่ง LINE เรียบร้อย ✅"
          : "นัดสัมภาษณ์แล้ว (ไม่มี LINE ID)"
      );
      onScheduled(candidate.id);
      onOpenChange(false);
      // reset
      setDate("");
      setStartTime("09:00");
      setLocation("");
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  const name = candidate ? getName(candidate) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            นัดสัมภาษณ์{name ? ` · ${name}` : ""}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Date */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              วันที่ <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Time */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              เวลา <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              สถานที่{" "}
              <span className="text-xs text-slate-400">(ว่างไว้ = ใช้ที่อยู่บริษัท)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="76/4 อาคารแพลตินัมเพลส ซอยรามคำแหง 178..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              หมายเหตุ
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ให้เตรียมเอกสาร, แต่งกายสุภาพ..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* LINE notice */}
          {candidate?.lineUserId && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              จะส่ง LINE แจ้งนัดให้{" "}
              <span className="font-semibold">{name}</span> อัตโนมัติ
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {loading ? "กำลังส่ง..." : "นัดสัมภาษณ์ + ส่ง LINE"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Candidate Card ────────────────────────────────────────────────────────────

function CandidateCard({
  c,
  actions,
}: {
  c: ShortlistCandidate;
  actions?: React.ReactNode;
}) {
  const name = getName(c);
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2">
        <Avatar c={c} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/candidates/${c.id}`}
            className="text-sm font-semibold text-slate-800 hover:text-blue-600 truncate block"
          >
            {name}
          </Link>
          {c.interestedPosition && (
            <p className="text-xs text-slate-400 truncate">{c.interestedPosition.title}</p>
          )}
        </div>
      </div>

      {/* Contact chips */}
      <div className="flex gap-1.5 flex-wrap">
        {c.phone && (
          <span className="inline-flex items-center gap-1 text-[10px] bg-slate-50 text-slate-500 rounded px-1.5 py-0.5 border border-slate-100">
            <Phone className="h-2.5 w-2.5" />
            {c.phone}
          </span>
        )}
        {c.lineUserId && (
          <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-600 rounded px-1.5 py-0.5 border border-green-100">
            <MessageCircle className="h-2.5 w-2.5" />
            LINE
          </span>
        )}
      </div>

      {actions && <div className="pt-1">{actions}</div>}
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

function Column({
  title,
  color,
  icon,
  count,
  children,
}: {
  title: string;
  color: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-w-0">
      {/* Column header */}
      <div className={`rounded-t-lg px-3 py-2.5 flex items-center gap-2 ${color}`}>
        {icon}
        <span className="font-semibold text-sm">{title}</span>
        <span className="ml-auto text-xs font-bold opacity-75 bg-white/30 rounded-full px-2 py-0.5">
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="bg-slate-50 rounded-b-lg border border-t-0 border-slate-200 p-2 space-y-2 min-h-[120px]">
        {children}
        {count === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-slate-400">
            ไม่มีรายการ
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ShortlistClient({ qualified, scheduled, interviewed, passed }: Props) {
  const [qualifiedList, setQualifiedList] = useState(qualified);
  const [scheduledList, setScheduledList] = useState(scheduled);
  const [interviewedList, setInterviewedList] = useState(interviewed);
  const [passedList, setPassedList] = useState(passed);

  const [scheduleTarget, setScheduleTarget] = useState<ShortlistCandidate | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Moving a candidate to a new status
  async function moveStatus(id: string, newStatus: string) {
    try {
      const res = await fetch(`/api/candidates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStatus: newStatus }),
      });
      if (!res.ok) throw new Error("อัปเดตสถานะไม่สำเร็จ");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      return false;
    }
  }

  // Called after scheduling → move candidate from qualified → scheduled
  function handleScheduled(id: string) {
    const c = qualifiedList.find((x) => x.id === id);
    if (!c) return;
    setQualifiedList((prev) => prev.filter((x) => x.id !== id));
    setScheduledList((prev) => [{ ...c, currentStatus: "INTERVIEW_SCHEDULED" }, ...prev]);
  }

  // INTERVIEWED → PASSED
  async function handleMarkPassed(c: ShortlistCandidate) {
    const ok = await moveStatus(c.id, "PASSED");
    if (!ok) return;
    setInterviewedList((prev) => prev.filter((x) => x.id !== c.id));
    setPassedList((prev) => [{ ...c, currentStatus: "PASSED" }, ...prev]);
    toast.success(`${getName(c)} ย้ายไปรอคอนเฟิร์มแล้ว`);
  }

  // INTERVIEW_SCHEDULED → INTERVIEWED
  async function handleMarkInterviewed(c: ShortlistCandidate) {
    const ok = await moveStatus(c.id, "INTERVIEWED");
    if (!ok) return;
    setScheduledList((prev) => prev.filter((x) => x.id !== c.id));
    setInterviewedList((prev) => [{ ...c, currentStatus: "INTERVIEWED" }, ...prev]);
    toast.success(`${getName(c)} มาร์กสัมภาษณ์แล้ว`);
  }

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Shortlist
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          ผู้สมัครที่ผ่านการพิจารณาเบื้องต้น · {qualifiedList.length + scheduledList.length + interviewedList.length + passedList.length} คน
        </p>
      </div>

      {/* 4 Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* ── ผ่าน (QUALIFIED) ── */}
        <Column
          title="ผ่านการพิจารณา"
          color="bg-emerald-500 text-white"
          icon={<UserCheck className="h-4 w-4" />}
          count={qualifiedList.length}
        >
          {qualifiedList.map((c) => (
            <CandidateCard
              key={c.id}
              c={c}
              actions={
                <Button
                  size="sm"
                  className="w-full h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {
                    setScheduleTarget(c);
                    setScheduleOpen(true);
                  }}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  นัดสัมภาษณ์
                </Button>
              }
            />
          ))}
        </Column>

        {/* ── นัดแล้ว (INTERVIEW_SCHEDULED) ── */}
        <Column
          title="นัดแล้ว"
          color="bg-blue-500 text-white"
          icon={<CalendarDays className="h-4 w-4" />}
          count={scheduledList.length}
        >
          {scheduledList.map((c) => (
            <CandidateCard
              key={c.id}
              c={c}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={() => handleMarkInterviewed(c)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  มาร์กสัมภาษณ์แล้ว
                </Button>
              }
            />
          ))}
        </Column>

        {/* ── สัมภาษณ์แล้ว (INTERVIEWED) ── */}
        <Column
          title="สัมภาษณ์แล้ว"
          color="bg-violet-500 text-white"
          icon={<MessageCircle className="h-4 w-4" />}
          count={interviewedList.length}
        >
          {interviewedList.map((c) => (
            <CandidateCard
              key={c.id}
              c={c}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs gap-1 border-violet-200 text-violet-700 hover:bg-violet-50"
                  onClick={() => handleMarkPassed(c)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  รอคอนเฟิร์มเริ่มงาน
                </Button>
              }
            />
          ))}
        </Column>

        {/* ── รอคอนเฟิร์มเริ่มงาน (PASSED) ── */}
        <Column
          title="รอคอนเฟิร์มเริ่มงาน"
          color="bg-amber-500 text-white"
          icon={<Trophy className="h-4 w-4" />}
          count={passedList.length}
        >
          {passedList.map((c) => (
            <CandidateCard key={c.id} c={c} />
          ))}
        </Column>
      </div>

      {/* Schedule dialog */}
      <ScheduleDialog
        candidate={scheduleTarget}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onScheduled={handleScheduled}
      />
    </section>
  );
}
