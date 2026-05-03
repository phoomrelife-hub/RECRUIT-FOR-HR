"use client";

import { useState } from "react";
import { HiringResult } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trophy, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

type HiringDecisionData = {
  id: string;
  result: HiringResult;
  reason: string | null;
  note: string | null;
  decidedBy: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

interface Props {
  candidateId: string;
  initialDecision: HiringDecisionData | null;
  currentUserRole: string;
}

const resultColor: Record<HiringResult, string> = {
  PASSED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-600",
  TALENT_POOL: "bg-cyan-100 text-cyan-700",
  HIRED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

const resultLabel: Record<HiringResult, string> = {
  PASSED: "ผ่านการคัดเลือก",
  REJECTED: "ไม่ผ่าน",
  TALENT_POOL: "เก็บไว้ใน Talent Pool",
  HIRED: "รับเข้าทำงาน",
  CLOSED: "ปิดเรื่อง",
};

export function HiringDecisionSection({ candidateId, initialDecision, currentUserRole }: Props) {
  const router = useRouter();
  const [decision, setDecision] = useState<HiringDecisionData | null>(initialDecision);
  const [selectedResult, setSelectedResult] = useState<HiringResult | "">(initialDecision?.result ?? "");
  const [reason, setReason] = useState(initialDecision?.reason ?? "");
  const [note, setNote] = useState(initialDecision?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(!initialDecision);

  const canEdit = currentUserRole === "SUPER_ADMIN" || currentUserRole === "HR_MANAGER";

  async function saveDecision() {
    if (!selectedResult) { toast.error("กรุณาเลือกผลการตัดสินใจ"); return; }
    setSaving(true);
    const res = await fetch(`/api/candidates/${candidateId}/hiring-decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: selectedResult, reason: reason || undefined, note: note || undefined }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("บันทึกการตัดสินใจไม่สำเร็จ"); return; }
    const data = await res.json();
    setDecision(data);
    setEditing(false);
    toast.success("บันทึกการตัดสินใจสำเร็จ");
    router.refresh();
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          Hiring Decision
        </CardTitle>
        {canEdit && decision && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-7 text-xs">
            แก้ไข
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Show existing decision */}
        {decision && !editing && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge className={`${resultColor[decision.result]} text-sm px-3 py-1`}>
                {resultLabel[decision.result]}
              </Badge>
            </div>
            {decision.reason && (
              <div>
                <p className="text-xs text-slate-500 font-medium mb-0.5">เหตุผล</p>
                <p className="text-sm text-slate-700">{decision.reason}</p>
              </div>
            )}
            {decision.note && (
              <div>
                <p className="text-xs text-slate-500 font-medium mb-0.5">หมายเหตุ</p>
                <p className="text-sm text-slate-700">{decision.note}</p>
              </div>
            )}
            <p className="text-xs text-slate-400">
              ตัดสินใจโดย {decision.decidedBy?.name ?? "—"} · {format(new Date(decision.updatedAt), "d MMM yyyy HH:mm")}
            </p>
          </div>
        )}

        {/* Edit/Create form */}
        {(editing || !decision) && canEdit && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">ผลการตัดสินใจ *</Label>
              <div className="flex gap-2 flex-wrap">
                {(["PASSED", "HIRED", "TALENT_POOL", "REJECTED", "CLOSED"] as HiringResult[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedResult((prev) => (prev === r ? "" : r))}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                      selectedResult === r
                        ? resultColor[r] + " border-current ring-1 ring-current"
                        : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"
                    }`}
                  >
                    {resultLabel[r]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">เหตุผล</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เหตุผลการตัดสินใจ..."
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">หมายเหตุ</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม..."
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveDecision} disabled={saving || !selectedResult} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
                บันทึกการตัดสินใจ
              </Button>
              {decision && (
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setSelectedResult(decision.result); setReason(decision.reason ?? ""); setNote(decision.note ?? ""); }}>
                  ยกเลิก
                </Button>
              )}
            </div>
          </div>
        )}

        {!canEdit && !decision && (
          <p className="text-xs text-slate-400 py-2 text-center">
            เฉพาะ HR Manager และ Super Admin เท่านั้นที่สามารถตัดสินใจได้
          </p>
        )}
      </CardContent>
    </Card>
  );
}
