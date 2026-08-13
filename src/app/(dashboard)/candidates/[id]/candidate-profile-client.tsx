"use client";

import { useState } from "react";
import { CandidateStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, MessageSquare, Tag, UserCheck, X, Trash2, ClipboardList, Star, CheckCircle, History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { InterviewSection } from "./interview-section";
import { HiringDecisionSection } from "./hiring-decision-section";
import { AssessmentSection, type AssessmentWithScores } from "./assessment-section";
import type { InterviewQuestion } from "@/lib/qualifier/types";

const statusColor: Record<CandidateStatus, string> = {
  NEW_APPLICANT: "bg-slate-100 text-slate-600",
  BOT_SCREENING: "bg-blue-100 text-blue-600",
  WAITING_HR_REVIEW: "bg-yellow-100 text-yellow-700",
  NEED_MORE_INFO: "bg-orange-100 text-orange-700",
  QUALIFIED: "bg-teal-100 text-teal-700",
  INTERVIEW_SCHEDULED: "bg-purple-100 text-purple-700",
  INTERVIEWED: "bg-indigo-100 text-indigo-700",
  PASSED: "bg-green-100 text-green-700",
  HIRED: "bg-teal-100 text-teal-700",
  REJECTED: "bg-red-100 text-red-600",
  TALENT_POOL: "bg-cyan-100 text-cyan-700",
  CLOSED: "bg-slate-100 text-slate-400",
};

const pipelineStages: CandidateStatus[] = [
  "NEW_APPLICANT", "BOT_SCREENING", "WAITING_HR_REVIEW", "NEED_MORE_INFO",
  "QUALIFIED", "INTERVIEW_SCHEDULED", "INTERVIEWED", "PASSED", "HIRED", "REJECTED",
  "TALENT_POOL", "CLOSED",
];

type TagData = { id: string; name: string; color: string };
type Note = { id: string; content: string; createdAt: Date; createdBy: { id: string; name: string } };
type Assignment = { id: string; assignedTo: { id: string; name: string } };
type ScreeningQuestion = { id: string; question: string; fieldKey: string; sortOrder: number };
type ScreeningForm = { id: string; title: string; questions: ScreeningQuestion[] };
type ScreeningAnswer = { id: string; screeningQuestionId: string; answer: string; screeningQuestion: ScreeningQuestion };
type CandidateScore = { experience: number; communication: number; availability: number; salaryFit: number; roleFit: number; attitude: number; totalScore: number };
type AiSummary = { summary: string; strengths: string | null; concerns: string | null; recommendation: string | null; nextAction: string | null; updatedAt: Date };

type InterviewFeedback = {
  id: string;
  communication: number; personality: number; experience: number;
  roleUnderstanding: number; availability: number; attitude: number;
  salaryExpectation: number | null;
  strengths: string | null; concerns: string | null; hrComment: string | null;
  finalResult: string | null;
  submittedBy: { id: string; name: string } | null;
  updatedAt: Date;
};

type InterviewItem = {
  id: string;
  interviewDate: Date;
  startTime: string;
  endTime: string;
  interviewType: string;
  status: string;
  location: string | null;
  meetingLink: string | null;
  note: string | null;
  interviewer: { id: string; name: string } | null;
  feedback: InterviewFeedback | null;
};

type HiringDecisionData = {
  id: string;
  result: string;
  reason: string | null;
  note: string | null;
  decidedBy: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

type StatusHistoryItem = {
  id: string;
  fromStatus: CandidateStatus | null;
  toStatus: CandidateStatus;
  reason: string | null;
  createdAt: Date;
};

type CandidateData = {
  id: string;
  interestedPositionId: string | null;
  currentStatus: CandidateStatus;
  updatedAt: Date;
  notes: Note[];
  tags: { tagId: string; tag: TagData }[];
  assignments: Assignment[];
  screeningAnswers: ScreeningAnswer[];
  candidateScore: CandidateScore | null;
  aiSummary: AiSummary | null;
  assessment: AssessmentWithScores | null;
  interviews: InterviewItem[];
  hiringDecision: HiringDecisionData | null;
  statusHistory: StatusHistoryItem[];
};

interface Props {
  candidate: CandidateData;
  jobs: { id: string; title: string }[];
  allTags: TagData[];
  hrUsers: { id: string; name: string; role: string }[];
  currentUserId: string;
  currentUserRole: string;
  screeningForm: ScreeningForm | null;
}

export function CandidateProfileClient({
  candidate,
  allTags,
  hrUsers,
  currentUserId,
  currentUserRole,
  screeningForm,
}: Props) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState<CandidateStatus>(candidate.currentStatus);
  const [notes, setNotes] = useState<Note[]>(candidate.notes);
  const [candidateTags, setCandidateTags] = useState<{ tagId: string; tag: TagData }[]>(candidate.tags);
  const [assignment, setAssignment] = useState<Assignment | null>(candidate.assignments[0] ?? null);
  const [noteText, setNoteText] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [statusReason, setStatusReason] = useState("");
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [savingTag, setSavingTag] = useState<string | null>(null);
  const [savingAssign, setSavingAssign] = useState(false);
  const [deletingNote, setDeletingNote] = useState<string | null>(null);

  // Screening state
  const answerMap = Object.fromEntries(candidate.screeningAnswers.map((a) => [a.screeningQuestionId, a.answer]));
  const [screeningAnswers, setScreeningAnswers] = useState<Record<string, string>>(answerMap);
  const [savingScreening, setSavingScreening] = useState(false);

  // Score state
  const initScore: CandidateScore = candidate.candidateScore ?? { experience: 0, communication: 0, availability: 0, salaryFit: 0, roleFit: 0, attitude: 0, totalScore: 0 };
  const [score, setScore] = useState<CandidateScore>(initScore);
  const [savingScore, setSavingScore] = useState(false);

  async function saveScreening() {
    if (!screeningForm) return;
    setSavingScreening(true);
    const answers = screeningForm.questions.map((q) => ({
      screeningQuestionId: q.id,
      answer: screeningAnswers[q.id] ?? "",
    }));
    const res = await fetch(`/api/candidates/${candidate.id}/screening`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setSavingScreening(false);
    if (!res.ok) { toast.error("บันทึก Screening ไม่สำเร็จ"); return; }
    toast.success("บันทึก Screening สำเร็จ");
  }

  function computeTotal(s: CandidateScore) {
    return s.experience + s.communication + s.availability + s.salaryFit + s.roleFit + s.attitude;
  }

  function updateScore(field: keyof Omit<CandidateScore, "totalScore">, val: number) {
    setScore((prev) => {
      const next = { ...prev, [field]: val };
      next.totalScore = computeTotal(next);
      return next;
    });
  }

  async function saveScore() {
    setSavingScore(true);
    const res = await fetch(`/api/candidates/${candidate.id}/score`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experience: score.experience,
        communication: score.communication,
        availability: score.availability,
        salaryFit: score.salaryFit,
        roleFit: score.roleFit,
        attitude: score.attitude,
      }),
    });
    setSavingScore(false);
    if (!res.ok) { toast.error("บันทึก Score ไม่สำเร็จ"); return; }
    const updated = await res.json();
    setScore(updated);
    toast.success("บันทึก Score สำเร็จ");
  }

  const assignedTagIds = new Set(candidateTags.map((ct) => ct.tagId));
  const unassignedTags = allTags.filter((t) => !assignedTagIds.has(t.id));

  async function handleStatusChange(newStatus: CandidateStatus) {
    if (newStatus === currentStatus) return;
    setSavingStatus(true);
    const res = await fetch(`/api/candidates/${candidate.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStatus: newStatus, statusReason }),
    });
    setSavingStatus(false);
    if (!res.ok) { toast.error("อัพเดตสถานะไม่สำเร็จ"); return; }
    setCurrentStatus(newStatus);
    setStatusReason("");
    toast.success("อัพเดตสถานะสำเร็จ");
    router.refresh();
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    const res = await fetch(`/api/candidates/${candidate.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteText }),
    });
    setSavingNote(false);
    if (!res.ok) { toast.error("บันทึกโน้ตไม่สำเร็จ"); return; }
    const note = await res.json();
    setNotes((prev) => [note, ...prev]);
    setNoteText("");
    toast.success("บันทึกโน้ตสำเร็จ");
  }

  async function deleteNote(noteId: string) {
    setDeletingNote(noteId);
    const res = await fetch(`/api/candidates/${candidate.id}/notes/${noteId}`, { method: "DELETE" });
    setDeletingNote(null);
    if (!res.ok) { toast.error("ลบโน้ตไม่สำเร็จ"); return; }
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    toast.success("ลบโน้ตสำเร็จ");
  }

  async function addTag(tagId: string) {
    setSavingTag(tagId);
    const res = await fetch(`/api/candidates/${candidate.id}/tags/${tagId}`, { method: "POST" });
    setSavingTag(null);
    if (!res.ok) { toast.error("เพิ่ม tag ไม่สำเร็จ"); return; }
    const data = await res.json();
    setCandidateTags((prev) => [...prev, { tagId, tag: data.tag }]);
    setTagMenuOpen(false);
  }

  async function removeTag(tagId: string) {
    setSavingTag(tagId);
    const res = await fetch(`/api/candidates/${candidate.id}/tags/${tagId}`, { method: "DELETE" });
    setSavingTag(null);
    if (!res.ok) { toast.error("ลบ tag ไม่สำเร็จ"); return; }
    setCandidateTags((prev) => prev.filter((ct) => ct.tagId !== tagId));
  }

  async function assignTo(userId: string) {
    setSavingAssign(true);
    const res = await fetch(`/api/candidates/${candidate.id}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: userId }),
    });
    setSavingAssign(false);
    if (!res.ok) { toast.error("Assign ไม่สำเร็จ"); return; }
    const data = await res.json();
    setAssignment(data);
    toast.success(`Assigned ให้ ${data.assignedTo.name}`);
  }

  async function unassign() {
    setSavingAssign(true);
    const res = await fetch(`/api/candidates/${candidate.id}/assignments`, { method: "DELETE" });
    setSavingAssign(false);
    if (!res.ok) { toast.error("Unassign ไม่สำเร็จ"); return; }
    setAssignment(null);
    toast.success("ยกเลิก assignment สำเร็จ");
  }

  return (
    <div className="space-y-4">
      {/* Status Change */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">สถานะปัจจุบัน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className={`${statusColor[currentStatus]} text-sm px-3 py-1`}>
              {currentStatus.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="flex gap-1 flex-wrap">
            {pipelineStages.map((stage) => {
              const idx = pipelineStages.indexOf(stage);
              const currentIdx = pipelineStages.indexOf(currentStatus);
              const isPast = idx < currentIdx;
              const isCurrent = stage === currentStatus;
              return (
                <button
                  key={stage}
                  onClick={() => handleStatusChange(stage)}
                  disabled={savingStatus}
                  className={`rounded px-2 py-1 text-xs font-medium transition-all ${
                    isCurrent
                      ? `${statusColor[stage]} ring-2 ring-offset-1 ring-current`
                      : isPast
                      ? "bg-slate-100 text-slate-400 hover:bg-slate-200"
                      : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {stage.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs">เหตุผลการเปลี่ยนสถานะ (ถ้ามี)</Label>
            <Textarea
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="เหตุผล..."
              rows={2}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4 text-slate-400" />
            Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {candidateTags.map((ct) => (
              <span
                key={ct.tagId}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: ct.tag.color }}
              >
                {ct.tag.name}
                <button
                  onClick={() => removeTag(ct.tagId)}
                  disabled={savingTag === ct.tagId}
                  className="ml-0.5 hover:opacity-70 disabled:opacity-40"
                >
                  {savingTag === ct.tagId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
              </span>
            ))}
            {candidateTags.length === 0 && (
              <span className="text-xs text-slate-400">ยังไม่มี tag</span>
            )}
          </div>

          {unassignedTags.length > 0 && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTagMenuOpen((v) => !v)}
                className="text-xs h-7"
              >
                <Plus className="h-3 w-3 mr-1" /> เพิ่ม Tag
              </Button>
              {tagMenuOpen && (
                <div className="absolute left-0 top-8 z-10 w-56 rounded-md border border-slate-200 bg-white shadow-lg">
                  <div className="max-h-48 overflow-y-auto p-1">
                    {unassignedTags.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => addTag(t.id)}
                        disabled={savingTag === t.id}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        {t.name}
                        {savingTag === t.id && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-slate-400" />
            Assigned To
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assignment ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
                  {assignment.assignedTo.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-700">{assignment.assignedTo.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={unassign}
                disabled={savingAssign}
                className="text-xs text-slate-400 hover:text-red-500 h-7"
              >
                {savingAssign ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3 mr-1" />}
                ยกเลิก
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-400">ยังไม่ได้ assign</p>
          )}

          <div className="flex flex-wrap gap-1.5 pt-1">
            {hrUsers
              .filter((u) => u.id !== assignment?.assignedTo.id)
              .map((u) => (
                <button
                  key={u.id}
                  onClick={() => assignTo(u.id)}
                  disabled={savingAssign}
                  className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 transition-colors"
                >
                  {savingAssign ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
                  {u.name}
                </button>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-slate-400" />
            Notes ({notes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="เพิ่มโน้ต..."
              rows={3}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={addNote}
              disabled={savingNote || !noteText.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {savingNote ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              Add Note
            </Button>
          </div>

          <div className="divide-y divide-slate-100">
            {notes.map((note) => {
              const canDelete = note.createdBy.id === currentUserId || currentUserRole === "SUPER_ADMIN";
              return (
                <div key={note.id} className="py-3 group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">{note.createdBy.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        {format(new Date(note.createdAt), "d MMM yy HH:mm")}
                      </span>
                      {canDelete && (
                        <button
                          onClick={() => deleteNote(note.id)}
                          disabled={deletingNote === note.id}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all disabled:opacity-50"
                        >
                          {deletingNote === note.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{note.content}</p>
                </div>
              );
            })}
            {notes.length === 0 && (
              <p className="py-4 text-center text-xs text-slate-400">ยังไม่มีโน้ต</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Screening Answers */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-400" />
            Screening Answers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!screeningForm ? (
            <p className="text-xs text-slate-400 py-2 text-center">
              ยังไม่มี Screening Form สำหรับตำแหน่งนี้
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {screeningForm.questions.map((q) => (
                  <div key={q.id} className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">{q.question}</Label>
                    <Textarea
                      value={screeningAnswers[q.id] ?? ""}
                      onChange={(e) =>
                        setScreeningAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      placeholder="คำตอบ..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                onClick={saveScreening}
                disabled={savingScreening}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {savingScreening ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                )}
                บันทึก Screening
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Score */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Star className="h-4 w-4 text-slate-400" />
            การให้คะแนน
            {score.totalScore > 0 && (
              <span className={`ml-auto text-sm font-bold ${
                score.totalScore >= 48 ? "text-green-600" : score.totalScore >= 30 ? "text-amber-600" : "text-red-500"
              }`}>
                {score.totalScore}/60
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(
            [
              { key: "experience", label: "ประสบการณ์" },
              { key: "communication", label: "การสื่อสาร" },
              { key: "availability", label: "ความพร้อม" },
              { key: "salaryFit", label: "เงินเดือนเหมาะสม" },
              { key: "roleFit", label: "เหมาะกับตำแหน่ง" },
              { key: "attitude", label: "ทัศนคติ" },
            ] as { key: keyof Omit<CandidateScore, "totalScore">; label: string }[]
          ).map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-slate-600 w-36 shrink-0">{label}</span>
              <div className="flex items-center gap-1.5 flex-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                  <button
                    key={v}
                    onClick={() => updateScore(key, v)}
                    className={`h-6 w-6 rounded text-xs font-medium transition-all ${
                      score[key] === v
                        ? v >= 8 ? "bg-green-500 text-white" : v >= 5 ? "bg-amber-400 text-white" : "bg-red-400 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <span className="text-xs font-semibold text-slate-700 w-6 text-right">{score[key]}</span>
            </div>
          ))}
          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">คะแนนรวม:</span>
              <span className={`text-base font-bold ${
                score.totalScore >= 48 ? "text-green-600" : score.totalScore >= 30 ? "text-amber-600" : "text-red-500"
              }`}>
                {score.totalScore}/60
              </span>
            </div>
            <Button size="sm" onClick={saveScore} disabled={savingScore} className="bg-blue-600 hover:bg-blue-700">
              {savingScore ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
              บันทึก Score
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Interviews */}
      <InterviewSection
        candidateId={candidate.id}
        jobPositionId={candidate.interestedPositionId}
        initialInterviews={candidate.interviews as any}
        hrUsers={hrUsers}
        currentUserRole={currentUserRole}
        suggestedQuestions={
          (candidate.assessment?.interviewQuestions as InterviewQuestion[] | undefined) ?? []
        }
      />

      {/* Hiring Decision */}
      <HiringDecisionSection
        candidateId={candidate.id}
        initialDecision={candidate.hiringDecision as any}
        currentUserRole={currentUserRole}
      />

      {/* AI Assessment */}
      <AssessmentSection
        candidateId={candidate.id}
        initial={candidate.assessment}
        candidateUpdatedAt={String(candidate.updatedAt)}
      />

      {/* Status Timeline */}
      {candidate.statusHistory.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              ประวัติสถานะ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative border-l border-slate-200 ml-2 space-y-0">
              {candidate.statusHistory.map((h, i) => {
                const statusThai: Record<string, string> = {
                  NEW_APPLICANT: "ผู้สมัครใหม่", BOT_SCREENING: "บอทคัดกรอง",
                  WAITING_HR_REVIEW: "รอ HR พิจารณา", NEED_MORE_INFO: "ขอข้อมูลเพิ่ม",
                  QUALIFIED: "ผ่านเกณฑ์", INTERVIEW_SCHEDULED: "นัดสัมภาษณ์",
                  INTERVIEWED: "สัมภาษณ์แล้ว", PASSED: "ผ่านการคัดเลือก",
                  REJECTED: "ไม่ผ่าน", TALENT_POOL: "Talent Pool", CLOSED: "ปิด",
                };
                const isFirst = i === 0;
                return (
                  <li key={h.id} className="ml-4 pb-5 last:pb-0">
                    <span className={`absolute -left-[5px] flex h-2.5 w-2.5 items-center justify-center rounded-full ${isFirst ? "bg-blue-500" : "bg-slate-300"}`} />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {h.fromStatus && (
                            <>
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${statusColor[h.fromStatus]}`}>
                                {statusThai[h.fromStatus] ?? h.fromStatus}
                              </span>
                              <span className="text-slate-300 text-xs">→</span>
                            </>
                          )}
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${statusColor[h.toStatus]}`}>
                            {statusThai[h.toStatus] ?? h.toStatus}
                          </span>
                        </div>
                        {h.reason && (
                          <p className="text-xs text-slate-400 mt-0.5 italic">{h.reason}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                        {format(new Date(h.createdAt), "d MMM yy HH:mm")}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
