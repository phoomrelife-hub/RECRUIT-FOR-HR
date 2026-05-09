"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Phone,
  MessageCircle,
  ExternalLink,
  Inbox,
  Users,
} from "lucide-react";
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
  currentStatus: string;
  interestedPosition: { title: string } | null;
  createdAt: Date;
};

interface Props {
  initial: QueueCandidate[];
}

// ── Fixed position color palette ─────────────────────────────────────────────
const POSITION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  default: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
};

const PALETTE = [
  { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200"   },
  { bg: "bg-violet-50", text: "text-violet-700",  border: "border-violet-200" },
  { bg: "bg-emerald-50",text: "text-emerald-700", border: "border-emerald-200"},
  { bg: "bg-amber-50",  text: "text-amber-700",   border: "border-amber-200"  },
  { bg: "bg-rose-50",   text: "text-rose-700",    border: "border-rose-200"   },
  { bg: "bg-cyan-50",   text: "text-cyan-700",    border: "border-cyan-200"   },
  { bg: "bg-orange-50", text: "text-orange-700",  border: "border-orange-200" },
  { bg: "bg-pink-50",   text: "text-pink-700",    border: "border-pink-200"   },
];

function getPositionColor(title: string, index: number) {
  return PALETTE[index % PALETTE.length];
}

// ── Group candidates by position ─────────────────────────────────────────────
function groupByPosition(queue: QueueCandidate[]) {
  const map = new Map<string, QueueCandidate[]>();

  for (const c of queue) {
    const key = c.interestedPosition?.title ?? "__none__";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }

  // Sort groups: named positions first (by count desc), then "ไม่ระบุ" last
  const named = [...map.entries()]
    .filter(([k]) => k !== "__none__")
    .sort((a, b) => b[1].length - a[1].length);
  const none = map.get("__none__");

  const result: { title: string; candidates: QueueCandidate[] }[] = named.map(
    ([title, candidates]) => ({ title, candidates })
  );
  if (none?.length) result.push({ title: "ไม่ระบุตำแหน่ง", candidates: none });

  return result;
}

// ── Candidate Row ─────────────────────────────────────────────────────────────
function CandidateRow({
  c,
  loading,
  onQualify,
}: {
  c: QueueCandidate;
  loading: Record<string, "pass" | "fail">;
  onQualify: (c: QueueCandidate, result: "pass" | "fail") => void;
}) {
  const name = c.fullName ?? c.nickname ?? c.lineDisplayName ?? "ไม่ระบุชื่อ";
  const isLoading = !!loading[c.id];

  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300 transition-colors">
      {/* Avatar */}
      <div className="shrink-0">
        {c.lineProfilePicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.lineProfilePicUrl}
            alt={name}
            className="h-10 w-10 rounded-full object-cover border-2 border-green-200"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-200">
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
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
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
          onClick={() => onQualify(c, "pass")}
        >
          {loading[c.id] === "pass" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <><CheckCircle className="h-3.5 w-3.5 mr-1" />ผ่าน</>
          )}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-8 px-3 text-xs"
          disabled={isLoading}
          onClick={() => onQualify(c, "fail")}
        >
          {loading[c.id] === "fail" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <><XCircle className="h-3.5 w-3.5 mr-1" />ไม่ผ่าน</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
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

  const groups = groupByPosition(queue);

  return (
    <div className="space-y-6">
      {groups.map(({ title, candidates }, groupIndex) => {
        const color = getPositionColor(title, groupIndex);

        return (
          <div key={title}>
            {/* Section header */}
            <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${color.border}`}>
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${color.bg} ${color.text}`}>
                <Users className="h-3 w-3" />
                {title}
              </div>
              <span className={`text-xs font-medium ${color.text}`}>
                {candidates.length} คน
              </span>
            </div>

            {/* Candidate rows */}
            <div className="space-y-2">
              {candidates.map((c) => (
                <CandidateRow
                  key={c.id}
                  c={c}
                  loading={loading}
                  onQualify={handleQualify}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
