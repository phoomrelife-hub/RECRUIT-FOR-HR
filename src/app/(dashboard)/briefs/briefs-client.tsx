"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Star, ArrowRight, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { WorkPreference } from "@prisma/client";

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
  notifyStars: number;
  minProximity: string | null;
  criteria: BriefCriterionView[];
  strongMatches: number;
}

export interface PositionRow {
  id: string;
  title: string;
  workType: string;
  brief: BriefView | null;
}

const WORK_LABEL: Record<string, string> = {
  ONSITE: "เข้าออฟฟิศ",
  WFH: "WFH",
  HYBRID: "ผสม",
};

/** Distance thresholds HR can require, loosest last. */
const PROXIMITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "ไม่จำกัดระยะทาง" },
  { value: "adjacent", label: "เฉพาะใกล้ออฟฟิศมาก (มีนบุรีและเขตติดกัน)" },
  { value: "nearby", label: "กรุงเทพฝั่งตะวันออก เดินทางสะดวก" },
  { value: "bangkok", label: "อยู่ในกรุงเทพ" },
  { value: "commutable_province", label: "กรุงเทพและปริมณฑล" },
];

const PROXIMITY_LABEL: Record<string, string> = Object.fromEntries(
  PROXIMITY_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]),
);

const PLACEHOLDER = `ตัวอย่าง:
รับ Sales Admin เข้าออฟฟิศเท่านั้น ตอนนี้ปิดรับ WFH แล้ว
อายุ 20-40 ปี ประสบการณ์ขาย 2 ปีขึ้นไป
งบเงินเดือนไม่เกิน 20,000
อยากได้คนที่เคยขายสินค้าสุขภาพหรือความงาม และดูตั้งใจจริง`;

/** The parsed hard filters, rendered as chips so HR can see what became a rule. */
function FilterChips({ brief }: { brief: BriefView }) {
  const chips: string[] = [];
  if (brief.minAge || brief.maxAge) {
    chips.push(`อายุ ${brief.minAge ?? "-"}–${brief.maxAge ?? "-"} ปี`);
  }
  if (brief.maxSalary) chips.push(`งบไม่เกิน ${brief.maxSalary.toLocaleString()}`);
  if (brief.minSalary) chips.push(`ขั้นต่ำ ${brief.minSalary.toLocaleString()}`);
  if (brief.workPreference) chips.push(WORK_LABEL[brief.workPreference] ?? brief.workPreference);
  if (brief.minExperienceYears) chips.push(`ประสบการณ์ ${brief.minExperienceYears}+ ปี`);
  if (brief.minSalesAmount) chips.push(`ยอดขาย ${brief.minSalesAmount.toLocaleString()}+`);
  if (brief.minProximity) chips.push(`ที่อยู่: ${PROXIMITY_LABEL[brief.minProximity] ?? brief.minProximity}`);

  if (chips.length === 0) {
    return <p className="text-xs text-slate-400">ยังไม่มีเงื่อนไขตัวเลข — คัดจากเนื้อหาล้วน</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <Badge key={c} className="bg-slate-100 text-slate-700 hover:bg-slate-100">
          {c}
        </Badge>
      ))}
    </div>
  );
}

function PositionCard({ row }: { row: PositionRow }) {
  const router = useRouter();
  const [text, setText] = useState(row.brief?.rawBrief ?? "");
  const [editing, setEditing] = useState(!row.brief);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [savingProx, setSavingProx] = useState(false);

  async function save() {
    if (text.trim().length < 5) {
      toast.error("กรุณาเขียนบรีฟให้ยาวกว่านี้");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobPositionId: row.id, rawBrief: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
      toast.success("AI อ่านบรีฟเรียบร้อย");
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function saveProximity(value: string) {
    if (!row.brief) return;
    setSavingProx(true);
    try {
      const res = await fetch(`/api/briefs/${row.brief.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minProximity: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
      // hashChanged means the cached scores are now stale and a re-run will
      // actually re-evaluate rather than returning everyone from cache.
      toast.success(json.hashChanged ? "บันทึกแล้ว — กด 'คัดผู้สมัคร' อีกครั้งเพื่อใช้เกณฑ์ใหม่" : "บันทึกแล้ว");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingProx(false);
    }
  }

  async function run() {
    if (!row.brief) return;
    setRunning(true);
    try {
      // Dry run first, always. This spends money, so HR confirms the count and
      // the estimate before anything is sent to the model.
      const preview = await fetch(`/api/briefs/${row.brief.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      }).then((r) => r.json());

      if (!preview.wouldScore) {
        toast.info("ไม่มีผู้สมัครใหม่ที่ต้องคัด");
        return;
      }
      const ok = window.confirm(
        `จะคัดผู้สมัคร ${preview.wouldScore} คน (ค้างทั้งหมด ${preview.pending} คน)\n` +
          `ค่าใช้จ่ายโดยประมาณ $${preview.estimatedUsd}\n\nดำเนินการต่อ?`,
      );
      if (!ok) return;

      const res = await fetch(`/api/briefs/${row.brief.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, limit: preview.wouldScore }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "คัดไม่สำเร็จ");
      toast.success(
        `คัดเสร็จ ${json.scored} คน · ตัดออกด้วยเงื่อนไข ${json.filteredOut} คน` +
          (json.failed ? ` · ล้มเหลว ${json.failed}` : ""),
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "คัดไม่สำเร็จ");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">{row.title}</h2>
          <p className="text-xs text-slate-500">{WORK_LABEL[row.workType] ?? row.workType}</p>
        </div>
        {row.brief && row.brief.strongMatches > 0 && (
          <Link href={`/briefs/${row.brief.id}`}>
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">
              <Star className="mr-1 h-3 w-3 fill-amber-500 text-amber-500" />
              {row.brief.strongMatches} คนน่าสนใจ
            </Badge>
          </Link>
        )}
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={7}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              ให้ AI อ่านบรีฟ
            </Button>
            {row.brief && (
              <Button
                variant="outline"
                onClick={() => {
                  setText(row.brief?.rawBrief ?? "");
                  setEditing(false);
                }}
              >
                ยกเลิก
              </Button>
            )}
          </div>
        </div>
      ) : (
        row.brief && (
          <div className="mt-4 space-y-4">
            <p className="whitespace-pre-wrap text-sm text-slate-600">{row.brief.rawBrief}</p>

            <div className="space-y-2 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">เงื่อนไขที่ตรวจอัตโนมัติ</p>
              <FilterChips brief={row.brief} />
            </div>

            {row.brief.criteria.length > 0 && (
              <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">สิ่งที่ AI อ่านแล้วให้คะแนน</p>
                <ul className="space-y-1">
                  {row.brief.criteria.map((c) => (
                    <li key={c.name} className="text-sm text-slate-700">
                      • {c.name}{" "}
                      <span className="text-xs text-slate-400">น้ำหนัก {c.weight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500" htmlFor={`prox-${row.id}`}>
                จำกัดระยะทางจากออฟฟิศ (มีนบุรี)
              </label>
              <select
                id={`prox-${row.id}`}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={row.brief.minProximity ?? ""}
                onChange={(e) => saveProximity(e.target.value)}
                disabled={savingProx}
              >
                {PROXIMITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                คนที่ไม่ได้กรอกที่อยู่จะไม่ถูกตัดออก
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={run} disabled={running}>
                {running ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                คัดผู้สมัคร
              </Button>
              <Link href={`/briefs/${row.brief.id}`}>
                <Button variant="outline">
                  ดูผลคัด
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button variant="ghost" onClick={() => setEditing(true)}>
                แก้บรีฟ
              </Button>
            </div>
          </div>
        )
      )}
    </Card>
  );
}

export function BriefsClient({ positions }: { positions: PositionRow[] }) {
  if (positions.length === 0) {
    return (
      <Card className="border-slate-200 p-8 text-center text-sm text-slate-500">
        ยังไม่มีตำแหน่งที่เปิดรับ — เปิดตำแหน่งที่หน้า &ldquo;ตำแหน่งงาน&rdquo; ก่อน
      </Card>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {positions.map((p) => (
        <PositionCard key={p.id} row={p} />
      ))}
    </div>
  );
}
