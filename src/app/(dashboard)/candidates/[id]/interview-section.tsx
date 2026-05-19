"use client";

import { useState } from "react";
import { InterviewType, InterviewStatus, InterviewResult } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Calendar, Video, Phone, Building2, ChevronDown, ChevronUp, CheckCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

type InterviewFeedback = {
  id: string;
  communication: number;
  personality: number;
  experience: number;
  roleUnderstanding: number;
  availability: number;
  attitude: number;
  salaryExpectation: number | null;
  strengths: string | null;
  concerns: string | null;
  hrComment: string | null;
  finalResult: InterviewResult | null;
  submittedBy: { id: string; name: string } | null;
  updatedAt: Date;
};

type InterviewData = {
  id: string;
  interviewDate: Date;
  startTime: string;
  endTime: string;
  interviewType: InterviewType;
  status: InterviewStatus;
  location: string | null;
  meetingLink: string | null;
  note: string | null;
  interviewer: { id: string; name: string } | null;
  feedback: InterviewFeedback | null;
};

interface Props {
  candidateId: string;
  jobPositionId: string | null;
  initialInterviews: InterviewData[];
  hrUsers: { id: string; name: string }[];
  currentUserRole: string;
}

const typeIcon: Record<InterviewType, React.ReactNode> = {
  PHONE: <Phone className="h-3.5 w-3.5" />,
  ONLINE: <Video className="h-3.5 w-3.5" />,
  ONSITE: <Building2 className="h-3.5 w-3.5" />,
};

const typeLabel: Record<InterviewType, string> = {
  PHONE: "Phone",
  ONLINE: "Online",
  ONSITE: "On-site",
};

const statusColor: Record<InterviewStatus, string> = {
  SCHEDULED: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  NO_SHOW: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

const resultColor: Record<InterviewResult, string> = {
  PASSED: "bg-green-100 text-green-700",
  WAITING: "bg-yellow-100 text-yellow-700",
  REJECTED: "bg-red-100 text-red-600",
  NEED_SECOND_INTERVIEW: "bg-blue-100 text-blue-700",
};

const resultLabel: Record<InterviewResult, string> = {
  PASSED: "ผ่าน",
  WAITING: "รอพิจารณา",
  REJECTED: "ไม่ผ่าน",
  NEED_SECOND_INTERVIEW: "นัดสัมภาษณ์รอบ 2",
};

const scoreFields: { key: keyof Omit<InterviewFeedback, "id" | "salaryExpectation" | "strengths" | "concerns" | "hrComment" | "finalResult" | "submittedBy" | "updatedAt">; label: string }[] = [
  { key: "communication", label: "การสื่อสาร" },
  { key: "personality", label: "บุคลิกภาพ" },
  { key: "experience", label: "ประสบการณ์" },
  { key: "roleUnderstanding", label: "เข้าใจงาน" },
  { key: "availability", label: "ความพร้อม" },
  { key: "attitude", label: "ทัศนคติ" },
];

const initFeedbackScore = { communication: 0, personality: 0, experience: 0, roleUnderstanding: 0, availability: 0, attitude: 0 };

export function InterviewSection({ candidateId, jobPositionId, initialInterviews, hrUsers, currentUserRole }: Props) {
  const router = useRouter();
  const [interviews, setInterviews] = useState<InterviewData[]>(initialInterviews);
  const [showSchedule, setShowSchedule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);
  const [feedbackScores, setFeedbackScores] = useState<Record<string, typeof initFeedbackScore>>({});
  const [feedbackMeta, setFeedbackMeta] = useState<Record<string, { strengths: string; concerns: string; hrComment: string; finalResult: InterviewResult | "" }>>({});
  const [savingFeedback, setSavingFeedback] = useState<string | null>(null);
  const [deletingInterview, setDeletingInterview] = useState<string | null>(null);

  // Schedule form state
  const [form, setForm] = useState({
    interviewDate: "",
    startTime: "09:00",
    endTime: "10:00",
    interviewType: "ONSITE" as InterviewType,
    interviewerId: "",
    location: "",
    meetingLink: "",
    note: "",
  });

  async function scheduleInterview() {
    if (!form.interviewDate || !form.startTime || !form.endTime) {
      toast.error("กรุณากรอกวัน/เวลา");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateId,
        jobPositionId: jobPositionId ?? undefined,
        interviewDate: form.interviewDate,
        startTime: form.startTime,
        endTime: form.endTime,
        interviewType: form.interviewType,
        interviewerId: form.interviewerId || undefined,
        location: form.location || undefined,
        meetingLink: form.meetingLink || undefined,
        note: form.note || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("นัดสัมภาษณ์ไม่สำเร็จ"); return; }
    const created = await res.json();
    setInterviews((prev) => [...prev, created]);
    setShowSchedule(false);
    setForm({ interviewDate: "", startTime: "09:00", endTime: "10:00", interviewType: "ONSITE", interviewerId: "", location: "", meetingLink: "", note: "" });
    toast.success("นัดสัมภาษณ์สำเร็จ");
    router.refresh();
  }

  function initFeedbackFor(iv: InterviewData) {
    if (!feedbackScores[iv.id]) {
      const fb = iv.feedback;
      setFeedbackScores((prev) => ({
        ...prev,
        [iv.id]: fb ? { communication: fb.communication, personality: fb.personality, experience: fb.experience, roleUnderstanding: fb.roleUnderstanding, availability: fb.availability, attitude: fb.attitude } : { ...initFeedbackScore },
      }));
      setFeedbackMeta((prev) => ({
        ...prev,
        [iv.id]: fb ? { strengths: fb.strengths ?? "", concerns: fb.concerns ?? "", hrComment: fb.hrComment ?? "", finalResult: fb.finalResult ?? "" } : { strengths: "", concerns: "", hrComment: "", finalResult: "" },
      }));
    }
    setExpandedFeedback((prev) => (prev === iv.id ? null : iv.id));
  }

  async function submitFeedback(interviewId: string) {
    const scores = feedbackScores[interviewId] ?? { ...initFeedbackScore };
    const meta = feedbackMeta[interviewId] ?? { strengths: "", concerns: "", hrComment: "", finalResult: "" };
    setSavingFeedback(interviewId);
    const res = await fetch(`/api/interviews/${interviewId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...scores,
        strengths: meta.strengths || undefined,
        concerns: meta.concerns || undefined,
        hrComment: meta.hrComment || undefined,
        finalResult: meta.finalResult || null,
      }),
    });
    setSavingFeedback(null);
    if (!res.ok) { toast.error("บันทึก Feedback ไม่สำเร็จ"); return; }
    const feedback = await res.json();
    setInterviews((prev) => prev.map((iv) => iv.id === interviewId ? { ...iv, status: InterviewStatus.COMPLETED, feedback } : iv));
    setExpandedFeedback(null);
    toast.success("บันทึก Feedback สำเร็จ");
    router.refresh();
  }

  async function deleteInterview(interviewId: string) {
    if (!confirm("ต้องการลบนัดสัมภาษณ์นี้?")) return;
    setDeletingInterview(interviewId);
    const res = await fetch(`/api/interviews/${interviewId}`, { method: "DELETE" });
    setDeletingInterview(null);
    if (!res.ok) { toast.error("ลบไม่สำเร็จ"); return; }
    setInterviews((prev) => prev.filter((iv) => iv.id !== interviewId));
    toast.success("ลบนัดสัมภาษณ์เรียบร้อย");
    router.refresh();
  }

  const totalScore = (id: string) => {
    const s = feedbackScores[id];
    if (!s) return 0;
    return s.communication + s.personality + s.experience + s.roleUnderstanding + s.availability + s.attitude;
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          Interviews ({interviews.length})
        </CardTitle>
        <Button
          size="sm"
          onClick={() => setShowSchedule((v) => !v)}
          className="bg-blue-600 hover:bg-blue-700 h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" /> นัดสัมภาษณ์
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Schedule Form */}
        {showSchedule && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-800">นัดสัมภาษณ์ใหม่</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">วันที่สัมภาษณ์ *</Label>
                <input
                  type="date"
                  value={form.interviewDate}
                  onChange={(e) => setForm((f) => ({ ...f, interviewDate: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">เวลาเริ่ม *</Label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">เวลาสิ้นสุด *</Label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ประเภทการสัมภาษณ์</Label>
                <select
                  value={form.interviewType}
                  onChange={(e) => setForm((f) => ({ ...f, interviewType: e.target.value as InterviewType }))}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ONSITE">On-site</option>
                  <option value="ONLINE">Online</option>
                  <option value="PHONE">Phone</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ผู้สัมภาษณ์</Label>
                <select
                  value={form.interviewerId}
                  onChange={(e) => setForm((f) => ({ ...f, interviewerId: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— ไม่ระบุ —</option>
                  {hrUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              {(form.interviewType === "ONSITE") && (
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">สถานที่</Label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="สถานที่สัมภาษณ์..."
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              {(form.interviewType === "ONLINE") && (
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Meeting Link</Label>
                  <input
                    type="url"
                    value={form.meetingLink}
                    onChange={(e) => setForm((f) => ({ ...f, meetingLink: e.target.value }))}
                    placeholder="https://meet.google.com/..."
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">หมายเหตุ</Label>
                <Textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="หมายเหตุเพิ่มเติม..."
                  rows={2}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={scheduleInterview} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
                บันทึกนัดสัมภาษณ์
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowSchedule(false)}>ยกเลิก</Button>
            </div>
          </div>
        )}

        {/* Interview List */}
        <div className="space-y-3">
          {interviews.map((iv) => (
            <div key={iv.id} className="rounded-lg border border-slate-100 bg-white overflow-hidden">
              <div className="p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    {typeIcon[iv.interviewType]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">
                        {typeLabel[iv.interviewType]}
                      </span>
                      <Badge className={`text-xs px-1.5 py-0 ${statusColor[iv.status]}`}>
                        {iv.status}
                      </Badge>
                      {iv.feedback?.finalResult && (
                        <Badge className={`text-xs px-1.5 py-0 ${resultColor[iv.feedback.finalResult]}`}>
                          {resultLabel[iv.feedback.finalResult]}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {format(new Date(iv.interviewDate), "d MMM yyyy")} · {iv.startTime} – {iv.endTime}
                      {iv.interviewer && ` · ${iv.interviewer.name}`}
                    </p>
                    {(iv.location || iv.meetingLink) && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {iv.location ?? iv.meetingLink}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 mt-1">
                  <button
                    onClick={() => initFeedbackFor(iv)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    {iv.feedback ? "แก้ไข Feedback" : "บันทึก Feedback"}
                    {expandedFeedback === iv.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {iv.status === "SCHEDULED" && (
                    <button
                      onClick={() => deleteInterview(iv.id)}
                      disabled={deletingInterview === iv.id}
                      title="ลบนัดสัมภาษณ์"
                      className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    >
                      {deletingInterview === iv.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Feedback Panel */}
              {expandedFeedback === iv.id && (
                <div className="border-t border-slate-100 p-3 bg-slate-50 space-y-3">
                  <p className="text-xs font-semibold text-slate-700">
                    Interview Feedback
                    {(feedbackScores[iv.id] && totalScore(iv.id) > 0) && (
                      <span className={`ml-2 font-bold ${totalScore(iv.id) >= 48 ? "text-green-600" : totalScore(iv.id) >= 30 ? "text-amber-600" : "text-red-500"}`}>
                        {totalScore(iv.id)}/60
                      </span>
                    )}
                  </p>

                  {/* Score grid */}
                  <div className="space-y-2">
                    {scoreFields.map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 w-28 shrink-0">{label}</span>
                        <div className="flex items-center gap-1 flex-1">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                            <button
                              key={v}
                              onClick={() => setFeedbackScores((prev) => ({ ...prev, [iv.id]: { ...(prev[iv.id] ?? initFeedbackScore), [key]: v } }))}
                              className={`h-5 w-5 rounded text-xs font-medium transition-all ${
                                (feedbackScores[iv.id]?.[key] ?? 0) === v
                                  ? v >= 8 ? "bg-green-500 text-white" : v >= 5 ? "bg-amber-400 text-white" : "bg-red-400 text-white"
                                  : "bg-white border border-slate-200 text-slate-400 hover:bg-slate-100"
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        <span className="text-xs font-semibold w-4 text-right text-slate-700">
                          {feedbackScores[iv.id]?.[key] ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Text fields */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">จุดเด่น</Label>
                      <Textarea
                        value={feedbackMeta[iv.id]?.strengths ?? ""}
                        onChange={(e) => setFeedbackMeta((prev) => ({ ...prev, [iv.id]: { ...(prev[iv.id] ?? { strengths: "", concerns: "", hrComment: "", finalResult: "" }), strengths: e.target.value } }))}
                        rows={2}
                        className="text-xs"
                        placeholder="จุดเด่นของผู้สมัคร..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">ข้อกังวล</Label>
                      <Textarea
                        value={feedbackMeta[iv.id]?.concerns ?? ""}
                        onChange={(e) => setFeedbackMeta((prev) => ({ ...prev, [iv.id]: { ...(prev[iv.id] ?? { strengths: "", concerns: "", hrComment: "", finalResult: "" }), concerns: e.target.value } }))}
                        rows={2}
                        className="text-xs"
                        placeholder="ข้อกังวล..."
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">ความเห็น HR</Label>
                      <Textarea
                        value={feedbackMeta[iv.id]?.hrComment ?? ""}
                        onChange={(e) => setFeedbackMeta((prev) => ({ ...prev, [iv.id]: { ...(prev[iv.id] ?? { strengths: "", concerns: "", hrComment: "", finalResult: "" }), hrComment: e.target.value } }))}
                        rows={2}
                        className="text-xs"
                        placeholder="ความเห็นเพิ่มเติม..."
                      />
                    </div>
                  </div>

                  {/* Final Result */}
                  <div className="space-y-1">
                    <Label className="text-xs">ผลการสัมภาษณ์</Label>
                    <div className="flex gap-2 flex-wrap">
                      {(["PASSED", "WAITING", "REJECTED", "NEED_SECOND_INTERVIEW"] as InterviewResult[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => setFeedbackMeta((prev) => ({ ...prev, [iv.id]: { ...(prev[iv.id] ?? { strengths: "", concerns: "", hrComment: "", finalResult: "" }), finalResult: (prev[iv.id]?.finalResult === r ? "" : r) } }))}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all ${
                            feedbackMeta[iv.id]?.finalResult === r
                              ? resultColor[r] + " border-current"
                              : "border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          {resultLabel[r]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => submitFeedback(iv.id)}
                    disabled={savingFeedback === iv.id}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {savingFeedback === iv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
                    บันทึก Feedback
                  </Button>
                </div>
              )}
            </div>
          ))}
          {interviews.length === 0 && (
            <p className="py-4 text-center text-xs text-slate-400">ยังไม่มีการนัดสัมภาษณ์</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
