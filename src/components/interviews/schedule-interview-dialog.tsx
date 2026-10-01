"use client";

// One interview-scheduling dialog for every screen (shortlist, inbox). It posts
// to /api/candidates/[id]/schedule-interview, which — unlike the bare
// /api/interviews — also sends the candidate the invite with the สะดวก/ไม่สะดวก
// buttons, moves them to INTERVIEW_SCHEDULED and drops the message in the inbox.

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, Loader2, MapPin, MessageCircle, Send, Video } from "lucide-react";
import { toast } from "sonner";

export type ScheduleCandidate = {
  id: string;
  name: string;
  positionTitle: string;
  /** Where the invite will go; null = candidate has no reachable channel. */
  notifyChannel: "LINE" | "FACEBOOK" | null;
};

type InterviewType = "onsite" | "online";
type JobOption = { id: string; title: string };

export function ScheduleInterviewDialog({
  candidate,
  open,
  onOpenChange,
  onScheduled,
}: {
  candidate: ScheduleCandidate | null;
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
  const [positionPick, setPositionPick] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobOptions, setJobOptions] = useState<JobOption[]>([]);

  const name = candidate?.name ?? "";
  const candidatePosition = candidate?.positionTitle ?? "";

  // fetch job positions once on mount
  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data: JobOption[]) => {
        if (Array.isArray(data)) setJobOptions(data);
      })
      .catch(() => {});
  }, []);

  // The picked position wins; until one is picked, the candidate's own applies.
  const positionLabel = positionPick ?? candidatePosition;

  function resetForm() {
    setPositionPick(null);
    setType("onsite");
    setDate("");
    setStartTime("09:00");
    setLocation("");
    setMeetingLink("");
    setInterviewer("");
    setNote("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidate) return;
    setLoading(true);
    try {
      const body = {
        type,
        date,
        startTime,
        positionLabel: positionLabel || candidatePosition || undefined,
        note: note || undefined,
        ...(type === "online"
          ? { meetingLink, interviewer: interviewer || undefined }
          : { location: location || undefined }),
      };

      const res = await fetch(`/api/candidates/${candidate.id}/schedule-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      if (data.lineSent) {
        toast.success(`นัดสัมภาษณ์แล้ว · ส่ง${candidate.notifyChannel === "FACEBOOK" ? " Messenger" : " LINE"}เรียบร้อย ✅`);
      } else if (candidate.notifyChannel) {
        // the interview is saved, only the message failed — say so instead of "no LINE ID"
        toast.warning("นัดสัมภาษณ์แล้ว แต่ส่งข้อความให้ผู้สมัครไม่สำเร็จ — ลองส่งเองในแชท");
      } else {
        toast.success("นัดสัมภาษณ์แล้ว (ผู้สมัครไม่มีช่องทางแชท)");
      }
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
                type === "onsite" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              On-site
            </button>
            <button
              type="button"
              onClick={() => setType("online")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors ${
                type === "online" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              Online
            </button>
          </div>

          {/* ── ตำแหน่ง (shared — both onsite and online) ── */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">ตำแหน่งที่สัมภาษณ์</label>
            {jobOptions.length > 0 ? (
              <select
                value={positionLabel}
                onChange={(e) => setPositionPick(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— เลือกตำแหน่ง —</option>
                {jobOptions.map((j) => (
                  <option key={j.id} value={j.title}>{j.title}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={positionLabel}
                onChange={(e) => setPositionPick(e.target.value)}
                placeholder={candidatePosition || "เช่น Sales Admin"}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* ── Online-only: ผู้สัมภาษณ์ ── */}
          {type === "online" && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">ผู้สัมภาษณ์</label>
              <input
                type="text"
                value={interviewer}
                onChange={(e) => setInterviewer(e.target.value)}
                placeholder="เช่น คุณสมชาย / HR Manager"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
                สถานที่ <span className="text-xs text-slate-400">(ว่างไว้ = ใช้ที่อยู่บริษัท)</span>
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
            <label className="text-sm font-medium text-slate-700 block mb-1">หมายเหตุ</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={type === "online" ? "เช่น กรุณาเปิดกล้องระหว่างสัมภาษณ์..." : "เช่น ให้เตรียมเอกสาร, แต่งกายสุภาพ..."}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {candidate?.notifyChannel && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              จะส่ง {candidate.notifyChannel === "FACEBOOK" ? "Messenger" : "LINE"} แจ้งนัดให้{" "}
              <span className="font-semibold">{name}</span> อัตโนมัติ
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {loading ? "กำลังส่ง..." : "นัดสัมภาษณ์ + ส่งข้อความ"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
