"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Filter, HelpCircle, FileText, Briefcase } from "lucide-react";
import type { WorkPreference } from "@prisma/client";
import type { ProximityTier } from "@/lib/brief/proximity";

export interface MatchRow {
  id: string;
  stars: number;
  overallScore: number;
  coveragePct: number;
  why: string;
  filteredOut: boolean;
  filterReason: string | null;
  proximityTier: ProximityTier;
  /** Nothing could be judged — held aside rather than ranked last. */
  noEvidence: boolean;
  candidate: {
    id: string;
    name: string;
    phone: string | null;
    age: number | null;
    expectedSalary: number | null;
    workPreference: WorkPreference | null;
    experienceText: string | null;
    currentStatus: string;
    address: string | null;
    maxSalesAmount: number | null;
    notionPageId: string | null;
    resumeUrl: string | null;
    portfolioUrl: string | null;
  };
}

const WORK_LABEL: Record<string, string> = {
  ONSITE: "เข้าออฟฟิศ",
  WFH: "WFH",
  HYBRID: "ผสม",
};

const PROXIMITY: Record<ProximityTier, { label: string; className: string }> = {
  adjacent: { label: "ใกล้ออฟฟิศมาก", className: "bg-green-100 text-green-800" },
  nearby: { label: "เดินทางสะดวก", className: "bg-emerald-100 text-emerald-800" },
  bangkok: { label: "ในกรุงเทพ", className: "bg-sky-100 text-sky-800" },
  commutable_province: { label: "ปริมณฑล", className: "bg-amber-100 text-amber-800" },
  far: { label: "ต่างจังหวัด", className: "bg-rose-100 text-rose-800" },
  unknown: { label: "ไม่ระบุที่อยู่", className: "bg-slate-100 text-slate-600" },
};

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={i <= n ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4 text-slate-200"}
        />
      ))}
    </span>
  );
}

function MatchCard({ row }: { row: MatchRow }) {
  const c = row.candidate;
  const prox = PROXIMITY[row.proximityTier] ?? PROXIMITY.unknown;

  return (
    <Card className="border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/candidates/${c.id}`}
              className="font-medium text-slate-900 hover:text-blue-600"
            >
              {c.name}
            </Link>
            <Badge className={`${prox.className} hover:${prox.className}`}>
              <MapPin className="mr-1 h-3 w-3" />
              {prox.label}
            </Badge>
          </div>

          {/* Facts HR asked to see. Contact details are shown here because HR
              needs them to make contact — they are simply never sent to the
              model (see scrub.ts / renderNotionEvidence). */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {c.age && <span>{c.age} ปี</span>}
            {c.expectedSalary && <span>ขอ {c.expectedSalary.toLocaleString()}</span>}
            {c.maxSalesAmount && <span>ยอดขายสูงสุด {c.maxSalesAmount.toLocaleString()}</span>}
            {c.workPreference && <span>{WORK_LABEL[c.workPreference]}</span>}
          </div>
          {c.address && (
            <p className="mt-1 truncate text-xs text-slate-400" title={c.address}>
              {c.address}
            </p>
          )}
        </div>

        <div className="text-right">
          {row.noEvidence ? (
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">
              <HelpCircle className="mr-1 h-3 w-3" />
              ข้อมูลไม่พอ
            </Badge>
          ) : (
            <>
              <Stars n={row.stars} />
              {/* Coverage sits next to the score deliberately: a 90 from thin
                  evidence and a 90 from a full application are not the same
                  claim. */}
              <p className="mt-1 text-[11px] text-slate-400">
                คะแนน {row.overallScore} · ข้อมูล {row.coveragePct}%
              </p>
            </>
          )}
        </div>
      </div>

      {row.filteredOut ? (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
          ตัดออก: {row.filterReason ?? "ไม่ผ่านเงื่อนไข"}
        </p>
      ) : (
        row.why && <p className="mt-3 text-sm text-slate-600">{row.why}</p>
      )}

      {c.experienceText && (
        <p className="mt-2 text-xs text-slate-400">ประสบการณ์: {c.experienceText}</p>
      )}

      {/* Only ~6% of applicants attach anything, so these are shown when they
          exist rather than as empty slots on every card. */}
      {(c.resumeUrl || c.portfolioUrl) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {c.resumeUrl && (
            <a
              href={c.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              <FileText className="h-3.5 w-3.5" />
              Resume
            </a>
          )}
          {c.portfolioUrl && (
            <a
              href={c.portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Portfolio
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

type View = "ranked" | "no_evidence" | "filtered";

export function MatchesClient({ matches }: { matches: MatchRow[] }) {
  const [minStars, setMinStars] = useState(3);
  const [view, setView] = useState<View>("ranked");

  const ranked = useMemo(
    () => matches.filter((m) => !m.filteredOut && !m.noEvidence),
    [matches],
  );
  const noEvidence = useMemo(
    () => matches.filter((m) => !m.filteredOut && m.noEvidence),
    [matches],
  );
  const filteredOut = useMemo(() => matches.filter((m) => m.filteredOut), [matches]);

  const visible = useMemo(() => {
    if (view === "no_evidence") return noEvidence;
    if (view === "filtered") return filteredOut;
    return ranked.filter((m) => m.stars >= minStars);
  }, [view, ranked, noEvidence, filteredOut, minStars]);

  if (matches.length === 0) {
    return (
      <Card className="border-slate-200 p-8 text-center text-sm text-slate-500">
        ยังไม่มีผลคัด — กด &ldquo;คัดผู้สมัคร&rdquo; ที่หน้าบรีฟก่อน
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[5, 4, 3, 1].map((n) => (
          <Button
            key={n}
            size="sm"
            variant={view === "ranked" && minStars === n ? "default" : "outline"}
            onClick={() => {
              setView("ranked");
              setMinStars(n);
            }}
          >
            <Star className="mr-1 h-3.5 w-3.5" />
            {n === 1 ? "ทั้งหมด" : `${n} ดาวขึ้นไป`}
            <Badge className="ml-2 bg-slate-100 text-slate-600 hover:bg-slate-100">
              {ranked.filter((m) => m.stars >= n).length}
            </Badge>
          </Button>
        ))}

        {noEvidence.length > 0 && (
          <Button
            size="sm"
            variant={view === "no_evidence" ? "default" : "outline"}
            onClick={() => setView("no_evidence")}
          >
            <HelpCircle className="mr-1 h-3.5 w-3.5" />
            ข้อมูลไม่พอ
            <Badge className="ml-2 bg-slate-100 text-slate-600 hover:bg-slate-100">
              {noEvidence.length}
            </Badge>
          </Button>
        )}

        {filteredOut.length > 0 && (
          <Button
            size="sm"
            variant={view === "filtered" ? "default" : "outline"}
            onClick={() => setView("filtered")}
          >
            <Filter className="mr-1 h-3.5 w-3.5" />
            ตัดออกด้วยเงื่อนไข
            <Badge className="ml-2 bg-slate-100 text-slate-600 hover:bg-slate-100">
              {filteredOut.length}
            </Badge>
          </Button>
        )}
      </div>

      {view === "no_evidence" && (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
          คนกลุ่มนี้ยังไม่มีข้อมูลพอให้ประเมิน — ไม่ได้แปลว่าไม่ดี ควรถามเพิ่มก่อนตัดสิน
        </p>
      )}

      {view === "ranked" && visible.length === 0 && (
        <p className="text-sm text-slate-500">ยังไม่มีใครถึงเกณฑ์นี้ — ลองลดจำนวนดาวลง</p>
      )}

      <div className="grid gap-3">
        {visible.map((m) => (
          <MatchCard key={m.id} row={m} />
        ))}
      </div>
    </div>
  );
}
