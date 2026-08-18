"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import type { WorkPreference } from "@prisma/client";
import { PositionRail } from "./_components/position-rail";
import { BriefEditor } from "./_components/brief-editor";

export interface BriefCriterionView {
  name: string;
  weight: number;
  description: string;
}

export interface BriefView {
  id: string;
  rawBrief: string;
  minAge: number | null;
  maxAge: number | null;
  minSalary: number | null;
  maxSalary: number | null;
  workPreference: WorkPreference | null;
  minExperienceYears: number | null;
  minSalesAmount: number | null;
  minProximity: string | null;
  requiredEquipment: string[];
  notifyStars: number;
  criteria: BriefCriterionView[];
  strongMatches: number;
}

export interface PositionRow {
  id: string;
  title: string;
  workType: string;
  headcount: number;
  waiting: number;
  brief: BriefView | null;
}

/**
 * Master-detail: positions on the left, the selected brief filling the right.
 *
 * Replaces a 2-column card grid where nine positions carried identical visual
 * weight and had to be scrolled through to find the one being worked on. The
 * rail makes the whole set reachable without scrolling AND makes the lopsided
 * workload legible at a glance.
 */
export function BriefsWorkbench({ positions }: { positions: PositionRow[] }) {
  const [selectedId, setSelectedId] = useState(positions[0]?.id ?? "");
  const selected = positions.find((p) => p.id === selectedId) ?? positions[0] ?? null;

  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <Target className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">
          ยังไม่มีตำแหน่งที่เปิดรับ — เปิดตำแหน่งที่หน้า &ldquo;ตำแหน่งงาน&rdquo; ก่อน
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">บรีฟหาคน</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          กรอกเงื่อนไขที่ตรวจได้เป็นช่อง ส่วนที่เหลือเขียนเป็นข้อความให้ AI อ่าน
        </p>
      </header>

      {/* Rail is a fixed 260px so the detail pane keeps a stable measure;
          stacks above the editor below lg rather than squeezing side by side. */}
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <PositionRail positions={positions} selectedId={selected?.id ?? ""} onSelect={setSelectedId} />
        {selected && <BriefEditor key={selected.id} position={selected} />}
      </div>
    </div>
  );
}
