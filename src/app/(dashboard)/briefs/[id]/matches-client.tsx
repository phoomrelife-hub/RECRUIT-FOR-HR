"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Phone, Filter } from "lucide-react";
import type { WorkPreference } from "@prisma/client";

export interface MatchRow {
  id: string;
  stars: number;
  overallScore: number;
  coveragePct: number;
  why: string;
  filteredOut: boolean;
  filterReason: string | null;
  candidate: {
    id: string;
    name: string;
    phone: string | null;
    age: number | null;
    expectedSalary: number | null;
    workPreference: WorkPreference | null;
    experienceText: string | null;
    currentStatus: string;
  };
}

const WORK_LABEL: Record<string, string> = {
  ONSITE: "เข้าออฟฟิศ",
  WFH: "WFH",
  HYBRID: "ผสม",
};

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={
            i <= n ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4 text-slate-200"
          }
        />
      ))}
    </span>
  );
}

function MatchCard({ row }: { row: MatchRow }) {
  const c = row.candidate;
  return (
    <Card className="border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href={`/candidates/${c.id}`}
            className="font-medium text-slate-900 hover:text-blue-600"
          >
            {c.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {c.age && <span>{c.age} ปี</span>}
            {c.expectedSalary && <span>ขอ {c.expectedSalary.toLocaleString()}</span>}
            {c.workPreference && <span>{WORK_LABEL[c.workPreference]}</span>}
            {c.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {c.phone}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <Stars n={row.stars} />
          {!row.filteredOut && (
            // Coverage is shown next to the score on purpose: a 90 from thin
            // evidence and a 90 from a full conversation are not the same claim.
            <p className="mt-1 text-[11px] text-slate-400">
              คะแนน {row.overallScore} · ข้อมูล {row.coveragePct}%
            </p>
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
    </Card>
  );
}

export function MatchesClient({ matches }: { matches: MatchRow[] }) {
  const [minStars, setMinStars] = useState(3);
  const [showFiltered, setShowFiltered] = useState(false);

  const counts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const m of matches) if (!m.filteredOut) c[m.stars] = (c[m.stars] ?? 0) + 1;
    return c;
  }, [matches]);

  const filteredOutCount = matches.filter((m) => m.filteredOut).length;

  const visible = useMemo(
    () =>
      showFiltered
        ? matches.filter((m) => m.filteredOut)
        : matches.filter((m) => !m.filteredOut && m.stars >= minStars),
    [matches, minStars, showFiltered],
  );

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
            variant={!showFiltered && minStars === n ? "default" : "outline"}
            onClick={() => {
              setShowFiltered(false);
              setMinStars(n);
            }}
          >
            <Star className="mr-1 h-3.5 w-3.5" />
            {n === 1 ? "ทั้งหมด" : `${n} ดาวขึ้นไป`}
            <Badge className="ml-2 bg-slate-100 text-slate-600 hover:bg-slate-100">
              {matches.filter((m) => !m.filteredOut && m.stars >= n).length}
            </Badge>
          </Button>
        ))}

        {filteredOutCount > 0 && (
          <Button
            size="sm"
            variant={showFiltered ? "default" : "outline"}
            onClick={() => setShowFiltered((v) => !v)}
          >
            <Filter className="mr-1 h-3.5 w-3.5" />
            ตัดออกด้วยเงื่อนไข
            <Badge className="ml-2 bg-slate-100 text-slate-600 hover:bg-slate-100">
              {filteredOutCount}
            </Badge>
          </Button>
        )}
      </div>

      {!showFiltered && counts[5] === 0 && minStars === 5 && (
        <p className="text-sm text-slate-500">
          ยังไม่มีใครได้ 5 ดาว — ลองดู 4 ดาวขึ้นไป
        </p>
      )}

      <div className="grid gap-3">
        {visible.map((m) => (
          <MatchCard key={m.id} row={m} />
        ))}
      </div>
    </div>
  );
}
