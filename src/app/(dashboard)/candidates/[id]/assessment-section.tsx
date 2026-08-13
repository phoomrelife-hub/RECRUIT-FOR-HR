"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Type-only import so the client bundle never pulls in the db-backed barrel file.
import type { InterviewQuestion } from "@/lib/qualifier/types";

interface CriterionScore {
  id: string; name: string; weight: number; score: number | null; reasoning: string;
}
interface SourceRecord { label: string; status: string; detail: string }

export interface AssessmentWithScores {
  id: string;
  overallScore: number;
  coveragePct: number;
  verdict: "STRONG" | "PROMISING" | "WEAK" | "INSUFFICIENT_DATA";
  summary: string;
  strengths: string | null;
  concerns: string | null;
  redFlags: string | null;
  unverifiedClaims: string | null;
  sourcesUsed: SourceRecord[];
  interviewQuestions: InterviewQuestion[];
  updatedAt: string;
  criterionScores: CriterionScore[];
}

const VERDICT_LABEL: Record<AssessmentWithScores["verdict"], { text: string; cls: string }> = {
  STRONG:            { text: "น่าสนใจมาก",        cls: "bg-emerald-100 text-emerald-800" },
  PROMISING:         { text: "พอไปได้",           cls: "bg-blue-100 text-blue-800" },
  WEAK:              { text: "ยังไม่ตรงเกณฑ์",     cls: "bg-amber-100 text-amber-800" },
  INSUFFICIENT_DATA: { text: "ข้อมูลไม่พอตัดสิน",  cls: "bg-slate-200 text-slate-700" },
};

const bullets = (raw: string | null) =>
  (raw ?? "").split("|").map((s) => s.trim()).filter(Boolean);

export function AssessmentSection({
  candidateId, initial, candidateUpdatedAt,
}: {
  candidateId: string;
  initial: AssessmentWithScores | null;
  candidateUpdatedAt: string;
}) {
  const [assessment, setAssessment] = useState(initial);
  const [running, setRunning] = useState(false);

  // Cheap staleness proxy: the candidate record changed after this assessment ran.
  const stale = Boolean(
    assessment && new Date(candidateUpdatedAt) > new Date(assessment.updatedAt),
  );

  async function run() {
    setRunning(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/assessment`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "ประเมินไม่สำเร็จ");
        return;
      }
      setAssessment(data);
      toast.success("ประเมินเสร็จแล้ว");
    } catch {
      toast.error("ประเมินไม่สำเร็จ");
    } finally {
      setRunning(false);
    }
  }

  const verdict = assessment ? VERDICT_LABEL[assessment.verdict] : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <Sparkles className="h-4 w-4 text-violet-500" />
          การประเมินโดย AI
        </h3>
        <Button variant="outline" size="sm" onClick={run} disabled={running}>
          {running
            ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> กำลังประเมิน…</>
            : <><RefreshCw className="mr-1 h-3 w-3" /> {assessment ? "ประเมินใหม่" : "ประเมิน"}</>}
        </Button>
      </div>

      {!assessment && !running && (
        <p className="text-sm text-slate-500">ยังไม่ได้ประเมิน — กดปุ่มด้านบนเพื่อให้ AI อ่านใบสมัครและ Resume</p>
      )}

      {stale && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          ข้อมูลผู้สมัครถูกแก้ไขหลังจากประเมินไปแล้ว — ควรกด &ldquo;ประเมินใหม่&rdquo;
        </div>
      )}

      {assessment && (
        <div className="space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-slate-900">{assessment.overallScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            {verdict && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${verdict.cls}`}>
                {verdict.text}
              </span>
            )}
            <span className="text-xs text-slate-400">
              ประเมินได้ {assessment.coveragePct}% ของเกณฑ์
            </span>
          </div>

          <p className="text-sm leading-relaxed text-slate-700">{assessment.summary}</p>

          <div className="space-y-2">
            {assessment.criterionScores.map((c) => (
              <div key={c.id}>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">{c.name}</span>
                  <span className={c.score === null ? "text-slate-400" : "text-slate-800"}>
                    {c.score === null ? "ไม่มีหลักฐาน" : `${c.score}/10`}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-slate-100">
                  <div
                    className={`h-1.5 rounded ${c.score === null ? "bg-slate-200" : "bg-violet-500"}`}
                    style={{ width: `${((c.score ?? 0) / 10) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">{c.reasoning}</p>
              </div>
            ))}
          </div>

          {bullets(assessment.redFlags).length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 p-3">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-red-800">
                <AlertTriangle className="h-3 w-3" /> สัญญาณที่ต้องระวัง
              </p>
              <ul className="list-inside list-disc text-xs text-red-700">
                {bullets(assessment.redFlags).map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          {bullets(assessment.unverifiedClaims).length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3">
              <p className="mb-1 text-xs font-semibold text-amber-800">ข้ออ้างที่ยังไม่มีหลักฐาน</p>
              <ul className="list-inside list-disc text-xs text-amber-700">
                {bullets(assessment.unverifiedClaims).map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          <div className="border-t border-slate-100 pt-3">
            <p className="mb-1 text-xs font-semibold text-slate-500">AI อ่านอะไรไปบ้าง</p>
            <ul className="space-y-0.5 text-xs text-slate-500">
              {assessment.sourcesUsed.map((s, i) => (
                <li key={i}>
                  <span className={s.status === "read" ? "text-emerald-600" : "text-slate-400"}>
                    {s.status === "read" ? "✓" : "✗"}
                  </span>{" "}
                  {s.label} — {s.detail}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
