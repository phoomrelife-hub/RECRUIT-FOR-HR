"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Props {
  candidateId: string;
  currentStatus: string;
  lineUserId: string | null;
  hasNotionPage: boolean;
}

const QUALIFIABLE_STATUSES = [
  "NEW_APPLICANT",
  "BOT_SCREENING",
  "WAITING_HR_REVIEW",
  "NEED_MORE_INFO",
];

export function QualifySection({ candidateId, currentStatus, lineUserId, hasNotionPage }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"pass" | "fail" | null>(null);
  const [done, setDone] = useState<"pass" | "fail" | null>(null);

  if (!QUALIFIABLE_STATUSES.includes(currentStatus)) return null;

  async function handleQualify(result: "pass" | "fail") {
    const label = result === "pass" ? "✅ ผ่าน" : "❌ ไม่ผ่าน";
    if (!confirm(`ยืนยันแจ้งผล "${label}" ไปยังผู้สมัคร?`)) return;

    setLoading(result);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/qualify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");

      setDone(result);
      const msgs: string[] = [];
      if (data.lineSent) msgs.push("ส่ง LINE แล้ว ✅");
      else if (lineUserId) msgs.push("ส่ง LINE ไม่สำเร็จ ⚠️");
      if (data.notionPatched) msgs.push("อัปเดต Notion แล้ว ✅");
      else if (hasNotionPage) msgs.push("Notion ไม่ถูกอัปเดต ⚠️");

      toast.success(`แจ้งผล ${label} สำเร็จ`, {
        description: msgs.join(" · ") || undefined,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  if (done) {
    return (
      <Card className={`border-2 ${done === "pass" ? "border-teal-300 bg-teal-50" : "border-red-200 bg-red-50"}`}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2">
            {done === "pass"
              ? <CheckCircle className="h-5 w-5 text-teal-600" />
              : <XCircle className="h-5 w-5 text-red-500" />}
            <span className={`text-sm font-semibold ${done === "pass" ? "text-teal-700" : "text-red-600"}`}>
              แจ้งผล{done === "pass" ? "ผ่าน" : "ไม่ผ่าน"}แล้ว
            </span>
            {lineUserId && (
              <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">
                <Send className="h-3 w-3" /> ส่ง LINE แล้ว
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-300 bg-yellow-50">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
          <Send className="h-4 w-4" />
          แจ้งผลการสมัคร
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 space-y-3">
        {lineUserId ? (
          <p className="text-xs text-yellow-700">
            กดเพื่อแจ้งผลและ<strong>ส่ง LINE ทันที</strong>
            {hasNotionPage && " + อัปเดต Notion อัตโนมัติ"}
          </p>
        ) : (
          <p className="text-xs text-yellow-700">ไม่มี LINE ID — จะอัปเดต status เท่านั้น</p>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            disabled={!!loading}
            onClick={() => handleQualify("pass")}
          >
            {loading === "pass" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
            ✅ ผ่าน
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            disabled={!!loading}
            onClick={() => handleQualify("fail")}
          >
            {loading === "fail" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
            ❌ ไม่ผ่าน
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
