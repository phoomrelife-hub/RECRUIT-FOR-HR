"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Phone, Briefcase, MessageCircle, ExternalLink, Inbox } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

type QueueCandidate = {
  id: string;
  nickname: string | null;
  fullName: string | null;
  lineDisplayName: string | null;
  lineProfilePicUrl: string | null;
  lineUserId: string | null;
  phone: string | null;
  notionPageId: string | null;
  interestedPosition: { title: string } | null;
  createdAt: Date;
};

interface Props {
  initial: QueueCandidate[];
}

export function ReviewClient({ initial }: Props) {
  const [queue, setQueue] = useState<QueueCandidate[]>(initial);
  const [loading, setLoading] = useState<Record<string, "pass" | "fail">>({});

  async function handleQualify(candidate: QueueCandidate, result: "pass" | "fail") {
    setLoading((prev) => ({ ...prev, [candidate.id]: result }));
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/qualify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");

      // ลบออกจาก queue ทันที
      setQueue((prev) => prev.filter((c) => c.id !== candidate.id));

      const label = result === "pass" ? "✅ ผ่าน" : "❌ ไม่ผ่าน";
      const name = candidate.fullName ?? candidate.nickname ?? candidate.lineDisplayName ?? "ไม่ระบุ";
      const msgs: string[] = [];
      if (data.lineSent) msgs.push("ส่ง LINE แล้ว");
      if (data.notionPatched) msgs.push("อัปเดต Notion แล้ว");

      toast.success(`${name} — ${label}`, {
        description: msgs.join(" · ") || undefined,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading((prev) => {
        const next = { ...prev };
        delete next[candidate.id];
        return next;
      });
    }
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Inbox className="h-12 w-12 mb-3 text-slate-300" />
        <p className="text-lg font-medium text-slate-500">ไม่มีใบสมัครที่รอพิจารณา</p>
        <p className="text-sm mt-1">เมื่อมีผู้สมัครใหม่จะแสดงที่นี่</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {queue.map((c) => {
        const name = c.fullName ?? c.nickname ?? c.lineDisplayName ?? "ไม่ระบุชื่อ";
        const isLoading = !!loading[c.id];

        return (
          <div
            key={c.id}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300 transition-colors"
          >
            {/* Avatar */}
            <div className="shrink-0">
              {c.lineProfilePicUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.lineProfilePicUrl}
                  alt={name}
                  className="h-11 w-11 rounded-full object-cover border-2 border-green-200"
                />
              ) : (
                <div className="h-11 w-11 rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-200">
                  <span className="text-slate-500 font-semibold text-sm">
                    {name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900 text-sm">{name}</span>
                {c.lineUserId && (
                  <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0 flex items-center gap-1">
                    <MessageCircle className="h-2.5 w-2.5" /> LINE
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                {c.interestedPosition && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {c.interestedPosition.title}
                  </span>
                )}
                {c.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {c.phone}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/candidates/${c.id}`} target="_blank">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white h-8 px-3 text-xs"
                disabled={isLoading}
                onClick={() => handleQualify(c, "pass")}
              >
                {loading[c.id] === "pass"
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <><CheckCircle className="h-3.5 w-3.5 mr-1" />ผ่าน</>}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 px-3 text-xs"
                disabled={isLoading}
                onClick={() => handleQualify(c, "fail")}
              >
                {loading[c.id] === "fail"
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <><XCircle className="h-3.5 w-3.5 mr-1" />ไม่ผ่าน</>}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
