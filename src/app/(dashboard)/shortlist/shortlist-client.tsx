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
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MessageCircle,
  MapPin,
  Phone,
  RefreshCw,
  Send,
  Trophy,
  UserCheck,
  Video,
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
  latestResponse: string | null; // "confirmed" | "declined" | null
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

function Avatar({ c }: { c: ShortlistCandidate }) {
  const name = getName(c);
  return c.lineProfilePicUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={c.lineProfilePicUrl}
      alt={name}
      className="h-8 w-8 rounded-full object-cover border border-slate-200 shrink-0"
    />
  ) : (
    <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
      <span className="text-xs font-semibold text-slate-500">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

// ── Schedule Interview Dialog ─────────────────────────────────────────────────

type InterviewType = "onsite" | "online";

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
  const [type, setType] = useState<InterviewType>("onsite");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [positionLabel, setPositionLabel] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  // pre-fill position when candidate changes
  const name = candidate ? getName(candidate) : "";
  const candidatePosition = candidate?.interestedPosition?.title ?? "";

  function resetForm() {
    setType("onsite");
    setDate("");
    setStartTime("09:00");
    setLocation("");
    setMeetingLink("");
    setInterviewer("");
    setPositionLabel("");
    setNote("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidate) return;
    setLoading(true);
    try {
      const body =
        type === "online"
          ? { type, date, startTime, meetingLink, interviewer: interviewer || undefined, positionLabel: positionLabel || candidatePosition || undefined, note: note || undefined }
          : { type, date, startTime, location: location || undefined, note: note || undefined };

      const res = await fetch(`/api/candidates/${candidate.id}/schedule-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            นัดสัมภาษณ์{name ? ` · ${name}` : ""}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* ── Type toggle ── */}
          <div className="flex rounded-lg border border-slate-200 p-1 gap-1 bg-slate-50">
            <button
              type="button"
              onClick={() => setType("onsite")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors ${
                type === "onsite"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              On-site
            </button>
            <button
              type="button"
              onClick={() => setType("online")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors ${
                type === "online"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              Online
            </button>
          </div>

          {/* ── Online-only fields ── */}
          {type === "online" && (
            <>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  ตำแหน่งที่สัมภาษณ์
                </label>
                <input
                  type="text"
                  value={positionLabel}
                  onChange={(e) => setPositionLabel(e.target.value)}
                  placeholder={candidatePosition || "เช่น Sales Admin"}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  ผู้สัมภาษณ์
                </label>
                <input
                  type="text"
                  value={interviewer}
                  onChange={(e) => setInterviewer(e.target.value)}
                  placeholder="เช่น คุณสมชาย / HR Manager"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* ── Date & Time (shared) ── */}
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          {/* ── Onsite: location / Online: meeting link ── */}
          {type === "onsite" ? (
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
          ) : (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                ลิงก์ประชุม <span className="text-red-500">*</span>
                <span className="text-xs text-slate-400 ml-1">(Google Meet, Zoom, Teams ฯลฯ)</span>
              </label>
              <input
                type="url"
                required
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* ── Note (shared) ── */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              หมายเหตุ
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                type === "online"
                  ? "เช่น กรุณาเปิดกล้องระหว่างสัมภาษณ์..."
                  : "เช่น ให้เตรียมเอกสาร, แต่งกายสุภาพ..."
              }
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

          <div className="flex justify-end gap-2 pt-1">
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
  const declined  = c.latestResponse === "declined";
  const confirmed = c.latestResponse === "confirmed";

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 hover:shadow-sm transition-shadow ${
        declined
          ? "bg-red-50 border-red-300"
          : "bg-white border-slate-200"
      }`}
    >
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
        {/* Response badge */}
        {declined && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold bg-red-100 text-red-600 rounded-full px-2 py-0.5">
            <AlertCircle className="h-3 w-3" />
            ไม่สะดวก
          </span>
        )}
        {confirmed && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold bg-green-100 text-green-600 rounded-full px-2 py-0.5">
            <CheckCircle2 className="h-3 w-3" />
            ยืนยันแล้ว
          </span>
        )}
      </div>

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
      <div className={`rounded-t-lg px-3 py-2.5 flex items-center gap-2 ${color}`}>
        {icon}
        <span className="font-semibold text-sm">{title}</span>
        <span className="ml-auto text-xs font-bold opacity-75 bg-white/30 rounded-full px-2 py-0.5">
          {count}
        </span>
      </div>
      <div className="bg-slate-50 rounded-b-lg border border-t-0 border-slate-200 p-2 space-y-2 min-h-[120px]">
        {children}
        {count === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-slate-400">
            ยังไม่มีรายการ
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

  function handleScheduled(id: string) {
    const c = qualifiedList.find((x) => x.id === id);
    if (!c) return;
    setQualifiedList((prev) => prev.filter((x) => x.id !== id));
    setScheduledList((prev) => [{ ...c, currentStatus: "INTERVIEW_SCHEDULED" }, ...prev]);
  }

  async function handleMarkInterviewed(c: ShortlistCandidate) {
    const ok = await moveStatus(c.id, "INTERVIEWED");
    if (!ok) return;
    setScheduledList((prev) => prev.filter((x) => x.id !== c.id));
    setInterviewedList((prev) => [{ ...c, currentStatus: "INTERVIEWED" }, ...prev]);
    toast.success(`${getName(c)} มาร์กสัมภาษณ์แล้ว`);
  }

  // เลื่อนนัด → กลับไป QUALIFIED (นัดใหม่ได้)
  async function handleReschedule(c: ShortlistCandidate) {
    const ok = await moveStatus(c.id, "QUALIFIED");
    if (!ok) return;
    setScheduledList((prev) => prev.filter((x) => x.id !== c.id));
    setQualifiedList((prev) => [{ ...c, currentStatus: "QUALIFIED", latestResponse: null }, ...prev]);
    toast.success(`${getName(c)} ย้ายกลับไปรอนัดใหม่แล้ว`);
  }

  async function handleMarkPassed(c: ShortlistCandidate) {
    const ok = await moveStatus(c.id, "PASSED");
    if (!ok) return;
    setInterviewedList((prev) => prev.filter((x) => x.id !== c.id));
    setPassedList((prev) => [{ ...c, currentStatus: "PASSED" }, ...prev]);
    toast.success(`${getName(c)} ย้ายไปรอคอนเฟิร์มแล้ว`);
  }

  async function handleReject(c: ShortlistCandidate) {
    const ok = await moveStatus(c.id, "REJECTED");
    if (!ok) return;
    setInterviewedList((prev) => prev.filter((x) => x.id !== c.id));
    toast.success(`${getName(c)} บันทึกไม่ผ่านแล้ว`);
  }

  const total = qualifiedList.length + scheduledList.length + interviewedList.length + passedList.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-slate-900">Shortlist</h1>
          {total > 0 && (
            <span className="ml-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-0.5">
              {total} คน
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          ติดตามผู้สมัครที่ผ่านการพิจารณา ตั้งแต่นัดสัมภาษณ์จนถึงรอเริ่มงาน
        </p>
      </div>

      {/* 4 Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* ผ่านการพิจารณา */}
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

        {/* นัดแล้ว */}
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
                c.latestResponse === "declined" ? (
                  // ไม่สะดวก → แสดงปุ่มเลื่อนนัดเด่น
                  <Button
                    size="sm"
                    className="w-full h-7 text-xs gap-1 bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleReschedule(c)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    เลื่อนนัด (นัดใหม่)
                  </Button>
                ) : (
                  // ปกติ / ยืนยันแล้ว → 2 ปุ่ม
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs gap-1 border-slate-200 text-slate-500 hover:bg-slate-50"
                      onClick={() => handleReschedule(c)}
                      title="เลื่อนนัด"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                      onClick={() => handleMarkInterviewed(c)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                      สัมภาษณ์แล้ว
                    </Button>
                  </div>
                )
              }
            />
          ))}
        </Column>

        {/* สัมภาษณ์แล้ว */}
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
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => handleReject(c)}
                  >
                    ❌ ไม่ผ่าน
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs gap-1 border-violet-200 text-violet-700 hover:bg-violet-50"
                    onClick={() => handleMarkPassed(c)}
                  >
                    ✅ ผ่าน
                  </Button>
                </div>
              }
            />
          ))}
        </Column>

        {/* รอคอนเฟิร์มเริ่มงาน */}
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

      <ScheduleDialog
        candidate={scheduleTarget}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onScheduled={handleScheduled}
      />
    </div>
  );
}
