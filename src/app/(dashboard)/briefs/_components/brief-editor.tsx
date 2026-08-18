"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, Loader2, Sparkles, Star, Wand2 } from "lucide-react";
import type { WorkPreference } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BriefView, PositionRow } from "../briefs-workbench";
import { EquipmentField, FieldGroup, NumberField, SegmentedField } from "./fields";
import { Bell } from "lucide-react";

const WORK_OPTIONS: Array<{ value: WorkPreference | null; label: string }> = [
  { value: null, label: "ไม่จำกัด" },
  { value: "ONSITE", label: "เข้าออฟฟิศ" },
  { value: "WFH", label: "WFH" },
  { value: "HYBRID", label: "ผสม" },
];

const PROXIMITY_OPTIONS: Array<{ value: string | null; label: string }> = [
  { value: null, label: "ไม่จำกัด" },
  { value: "adjacent", label: "ใกล้มาก" },
  { value: "nearby", label: "ฝั่งตะวันออก" },
  { value: "bangkok", label: "ในกรุงเทพ" },
  { value: "commutable_province", label: "+ ปริมณฑล" },
];

const PLACEHOLDER = `เช่น อยากได้คนที่เคยขายสินค้าสุขภาพหรือความงาม
ตอบแชทเร็ว ดูตั้งใจจริง เคยทำยอดเองไม่ใช่แค่รับออเดอร์`;

export function BriefEditor({ position }: { position: PositionRow }) {
  const router = useRouter();
  const [brief, setBrief] = useState<BriefView | null>(position.brief);
  const [creating, setCreating] = useState(false);
  const [notes, setNotes] = useState(position.brief?.rawBrief ?? "");
  const [parsing, setParsing] = useState(false);
  const [running, setRunning] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Saves are fire-and-forget per field, so a slow one must not overwrite a
  // newer value. Sequence numbers keep the last edit authoritative.
  const seq = useRef(0);

  const patch = useCallback(
    async (data: Record<string, unknown>) => {
      if (!brief) return;
      const mine = ++seq.current;
      // Optimistic: the field already shows the new value, so reverting on
      // arrival would make typing feel like it stuttered.
      setBrief((b) => (b ? { ...b, ...(data as Partial<BriefView>) } : b));
      try {
        const res = await fetch(`/api/briefs/${brief.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
        if (mine === seq.current) {
          setBrief((b) => (b ? { ...b, ...json.brief } : b));
          setSavedAt(Date.now());
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
        router.refresh();
      }
    },
    [brief, router],
  );

  async function createBrief() {
    setCreating(true);
    try {
      const res = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobPositionId: position.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "สร้างบรีฟไม่สำเร็จ");
      setBrief({ ...json.brief, criteria: [], strongMatches: 0 });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "สร้างบรีฟไม่สำเร็จ");
    } finally {
      setCreating(false);
    }
  }

  async function parseNotes() {
    if (!brief) return;
    setParsing(true);
    try {
      const res = await fetch(`/api/briefs/${brief.id}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawBrief: notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "อ่านข้อความไม่สำเร็จ");
      setBrief((b) => (b ? { ...b, ...json.brief, criteria: json.criteria } : b));
      toast.success(json.cleared ? "ล้างเกณฑ์เพิ่มเติมแล้ว" : "AI อ่านข้อความเรียบร้อย");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อ่านข้อความไม่สำเร็จ");
    } finally {
      setParsing(false);
    }
  }

  async function run() {
    if (!brief) return;
    setRunning(true);
    try {
      const preview = await fetch(`/api/briefs/${brief.id}/run`, {
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

      const res = await fetch(`/api/briefs/${brief.id}/run`, {
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

  if (!brief) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center">
        <h2 className="text-base font-medium text-slate-900">{position.title}</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          ยังไม่มีบรีฟสำหรับตำแหน่งนี้
          {position.waiting > 0 && ` — มีผู้สมัครรอพิจารณา ${position.waiting} คน`}
        </p>
        <Button onClick={createBrief} disabled={creating} className="mt-4 cursor-pointer">
          {creating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          สร้างบรีฟ
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{position.title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            รับ {position.headcount} คน
            {position.waiting > 0 && ` · รอพิจารณา ${position.waiting} คน`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Check className="h-3 w-3" />
              บันทึกแล้ว
            </span>
          )}
          {brief.strongMatches > 0 && (
            <Link
              href={`/briefs/${brief.id}`}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 transition-colors duration-150 hover:bg-amber-200"
            >
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              {brief.strongMatches} คนน่าสนใจ
            </Link>
          )}
        </div>
      </div>

      <FieldGroup title="คุณสมบัติผู้สมัคร" hint="เว้นว่าง = ไม่จำกัด">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            label="อายุขั้นต่ำ"
            suffix="ปี"
            value={brief.minAge}
            onCommit={(v) => patch({ minAge: v })}
          />
          <NumberField
            label="อายุสูงสุด"
            suffix="ปี"
            value={brief.maxAge}
            onCommit={(v) => patch({ maxAge: v })}
          />
          <NumberField
            label="ประสบการณ์ขั้นต่ำ"
            suffix="ปี"
            value={brief.minExperienceYears}
            onCommit={(v) => patch({ minExperienceYears: v })}
          />
          <NumberField
            label="ยอดขายสูงสุดที่เคยทำ"
            suffix="บาท"
            value={brief.minSalesAmount}
            onCommit={(v) => patch({ minSalesAmount: v })}
          />
        </div>
      </FieldGroup>

      <FieldGroup title="เงื่อนไขงาน">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="งบเงินเดือนสูงสุด"
              suffix="บาท"
              value={brief.maxSalary}
              onCommit={(v) => patch({ maxSalary: v })}
            />
            <NumberField
              label="เงินเดือนขั้นต่ำที่รับได้"
              suffix="บาท"
              value={brief.minSalary}
              onCommit={(v) => patch({ minSalary: v })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SegmentedField
              label="รูปแบบการทำงาน"
              value={brief.workPreference}
              options={WORK_OPTIONS}
              onSelect={(v) => patch({ workPreference: v ?? "" })}
            />
            <SegmentedField
              label="ระยะทางจากออฟฟิศ (มีนบุรี)"
              value={brief.minProximity}
              options={PROXIMITY_OPTIONS}
              onSelect={(v) => patch({ minProximity: v ?? "" })}
              hint="คนที่ไม่ได้กรอกที่อยู่จะไม่ถูกตัดออก"
            />
          </div>

          <EquipmentField
            value={brief.requiredEquipment}
            onChange={(v) => patch({ requiredEquipment: v })}
          />
        </div>
      </FieldGroup>

      <FieldGroup
        title="อื่นๆ ที่ต้องการ"
        hint="สิ่งที่เป็นตัวเลขไม่ได้ — เขียนเป็นภาษาคน แล้ว AI จะแปลงเป็นเกณฑ์ให้คะแนน"
      >
        <div className="space-y-3">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={4}
            className="text-sm"
            aria-label="เงื่อนไขเพิ่มเติมสำหรับ AI"
          />

          {brief.criteria.length > 0 && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">เกณฑ์ที่ AI จะใช้ให้คะแนน</p>
              <ul className="mt-1.5 space-y-1">
                {brief.criteria.map((c) => (
                  <li key={c.name} className="flex items-baseline gap-2 text-sm text-slate-700">
                    <span className="shrink-0 rounded bg-white px-1.5 text-[11px] tabular-nums text-slate-500 ring-1 ring-slate-200">
                      {c.weight}
                    </span>
                    <span>{c.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={parseNotes}
              disabled={parsing || notes === brief.rawBrief}
              className="cursor-pointer"
            >
              {parsing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              ให้ AI อ่าน
            </Button>
            {notes !== brief.rawBrief && (
              <span className="text-xs text-amber-600">ยังไม่ได้บันทึกข้อความนี้</span>
            )}
          </div>
        </div>
      </FieldGroup>

      <FieldGroup
        title="แจ้งเตือนเข้า Lark"
        hint="ผู้สมัครที่ไม่ถึงเกณฑ์จะรวมอยู่ในสรุปรายวันตอน 09:00 แทน"
      >
        <div className="space-y-4">
          <SegmentedField
            label="แจ้งทันทีเมื่อได้ดาวตั้งแต่"
            value={String(brief.notifyStars)}
            options={[3, 4, 5].map((n) => ({ value: String(n), label: `${n} ดาว` }))}
            onSelect={(v) => patch({ notifyStars: Number(v ?? 5) })}
          />

          <div className="rounded-lg bg-slate-50 p-3">
            <SegmentedField
              label="…หรือเมื่อตรงเงื่อนไขครบทุกข้อ และได้ดาวตั้งแต่"
              value={brief.notifyFullSpecStars === null ? "off" : String(brief.notifyFullSpecStars)}
              options={[
                { value: "off", label: "ปิด" },
                ...[2, 3, 4].map((n) => ({ value: String(n), label: `${n} ดาว` })),
              ]}
              onSelect={(v) =>
                patch({ notifyFullSpecStars: v === "off" || v === null ? null : Number(v) })
              }
            />
            {/* The reason this second route exists, stated where the setting is
                — otherwise a 3-star notification looks like a bug. */}
            <p className="mt-2 flex gap-1.5 text-[11px] leading-relaxed text-slate-500">
              <Bell className="mt-px h-3 w-3 shrink-0" aria-hidden />
              <span>
                ดาวคิดจากข้อความที่ AI อ่านเท่านั้น ไม่ได้คิดจากเงื่อนไขด้านบน
                คนที่ตรงเงื่อนไขที่ตั้งไว้ครบทุกข้อจึงอาจได้แค่ 3 ดาวเพราะเขียนมาน้อย —
                ข้อนี้ทำให้เขายังถูกแจ้งเตือน
              </span>
            </p>
          </div>
        </div>
      </FieldGroup>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <Button onClick={run} disabled={running} className="cursor-pointer">
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          คัดผู้สมัคร
        </Button>
        <Link href={`/briefs/${brief.id}`}>
          <Button variant="outline" className="cursor-pointer">
            ดูผลคัด
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <span className="ml-auto text-xs text-slate-400">
          จะแสดงจำนวนและค่าใช้จ่ายให้ยืนยันก่อนเริ่ม
        </span>
      </div>
    </div>
  );
}
