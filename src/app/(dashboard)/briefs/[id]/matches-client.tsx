"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Briefcase,
  FileText,
  Filter,
  HelpCircle,
  Laptop,
  Smartphone,
  Star,
  Tablet,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import type { WorkPreference } from "@prisma/client";
import type { ProximityTier } from "@/lib/brief/proximity";
import { tierRank } from "@/lib/brief/proximity";

export interface MatchRow {
  id: string;
  stars: number;
  overallScore: number;
  coveragePct: number;
  why: string;
  filteredOut: boolean;
  filterReason: string | null;
  proximityTier: ProximityTier;
  specMet: number;
  specTotal: number;
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
    equipment: string[];
  };
}

const PROXIMITY: Record<ProximityTier, { short: string; className: string }> = {
  adjacent: { short: "ใกล้มาก", className: "bg-green-100 text-green-800" },
  nearby: { short: "สะดวก", className: "bg-emerald-100 text-emerald-800" },
  bangkok: { short: "กรุงเทพ", className: "bg-sky-100 text-sky-800" },
  commutable_province: { short: "ปริมณฑล", className: "bg-amber-100 text-amber-800" },
  far: { short: "ต่างจังหวัด", className: "bg-rose-100 text-rose-800" },
  unknown: { short: "ไม่ระบุ", className: "bg-slate-100 text-slate-500" },
};

const EQUIPMENT_ICON: Record<string, LucideIcon> = {
  computer: Laptop,
  internet: Wifi,
  phone: Smartphone,
  tablet: Tablet,
};

type SortKey = "stars" | "spec" | "age" | "salary" | "proximity";

interface SortState {
  key: SortKey;
  dir: 1 | -1;
}

/**
 * Header cell.
 *
 * Declared at module scope on purpose: defining it inside the component body
 * makes React see a brand-new component type on every render, remounting each
 * header and throwing away focus mid-interaction.
 */
function Th({
  label,
  sortKey,
  className = "",
  sort,
  onSort,
}: {
  label: string;
  sortKey?: SortKey;
  className?: string;
  sort: SortState;
  onSort: (k: SortKey) => void;
}) {
  return (
    <th
      scope="col"
      // aria-sort belongs on the header cell, not on the button inside it —
      // the button's implicit role does not support the attribute.
      aria-sort={
        sortKey && sort.key === sortKey
          ? sort.dir === 1
            ? "ascending"
            : "descending"
          : undefined
      }
      className={`px-3 py-2 text-left text-xs font-medium text-slate-500 ${className}`}
    >
      {sortKey ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          aria-label={`เรียงตาม ${label}`}
          className={`inline-flex cursor-pointer items-center gap-1 rounded transition-colors duration-150 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            sort.key === sortKey ? "text-slate-900" : ""
          }`}
        >
          {label}
          <ArrowUpDown className="h-3 w-3" aria-hidden />
        </button>
      ) : (
        label
      )}
    </th>
  );
}
type View = "ranked" | "no_evidence" | "filtered";

/**
 * Stated requirements positively met.
 *
 * Sits beside the stars rather than folded into them: they measure different
 * things — stars are the model's judgement of prose, this is checkable fact —
 * and collapsing them into one number is what made a perfect-on-paper
 * candidate indistinguishable from someone we simply know nothing about.
 */
function SpecCell({ met, total }: { met: number; total: number }) {
  if (total === 0) return <span className="text-xs text-slate-300">—</span>;
  const full = met === total;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${
        full ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
      }`}
      title={full ? "ตรงเงื่อนไขครบทุกข้อ" : `ตรง ${met} จาก ${total} ข้อ ที่เหลือไม่มีข้อมูล`}
    >
      {met}/{total}
    </span>
  );
}

function StarCell({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" title={`${n} ดาว`}>
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="text-sm font-medium text-slate-900">{n}</span>
    </span>
  );
}

/** Sort with nulls always last, whichever direction — an unknown is not a low value. */
function cmpNullable(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * dir;
}

export function MatchesClient({ matches }: { matches: MatchRow[] }) {
  const [view, setView] = useState<View>("ranked");
  const [minStars, setMinStars] = useState(3);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "stars", dir: -1 });
  const [openId, setOpenId] = useState<string | null>(null);

  const ranked = useMemo(() => matches.filter((m) => !m.filteredOut && !m.noEvidence), [matches]);
  const noEvidence = useMemo(
    () => matches.filter((m) => !m.filteredOut && m.noEvidence),
    [matches],
  );
  const filteredOut = useMemo(() => matches.filter((m) => m.filteredOut), [matches]);

  const rows = useMemo(() => {
    const base =
      view === "no_evidence"
        ? noEvidence
        : view === "filtered"
          ? filteredOut
          : ranked.filter((m) => m.stars >= minStars);

    const { key, dir } = sort;
    return [...base].sort((a, b) => {
      if (key === "stars") return (a.stars - b.stars) * dir || b.overallScore - a.overallScore;
      // Ratio, not raw count: 3/3 is a stronger claim than 4/7.
      if (key === "spec") {
        const r = (m: MatchRow) => (m.specTotal ? m.specMet / m.specTotal : -1);
        return (r(a) - r(b)) * dir || b.specTotal - a.specTotal;
      }
      if (key === "age") return cmpNullable(a.candidate.age, b.candidate.age, dir);
      if (key === "salary")
        return cmpNullable(a.candidate.expectedSalary, b.candidate.expectedSalary, dir);
      return (tierRank(a.proximityTier) - tierRank(b.proximityTier)) * dir;
    });
  }, [view, ranked, noEvidence, filteredOut, minStars, sort]);

  const open = matches.find((m) => m.id === openId) ?? null;

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));

  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
        ยังไม่มีผลคัด — กด &ldquo;คัดผู้สมัคร&rdquo; ที่หน้าบรีฟก่อน
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["ranked", `จัดอันดับ (${ranked.length})`],
            ["no_evidence", `ข้อมูลไม่พอ (${noEvidence.length})`],
            ["filtered", `ตัดออก (${filteredOut.length})`],
          ] as Array<[View, string]>
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              view === v
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}

        {view === "ranked" && (
          <div className="ml-auto inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {[5, 4, 3, 1].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMinStars(n)}
                aria-pressed={minStars === n}
                className={`cursor-pointer rounded-md px-2 py-1 text-xs font-medium tabular-nums transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  minStars === n ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                {n === 1 ? "ทั้งหมด" : `${n}★+`}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "no_evidence" && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
          ยังไม่มีข้อมูลพอให้ประเมิน — ไม่ได้แปลว่าไม่ดี ควรถามเพิ่มก่อนตัดสิน
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <Th label="ชื่อ" sort={sort} onSort={toggleSort} />
                {view === "ranked" && <Th label="ดาว" sortKey="stars" sort={sort} onSort={toggleSort} />}
                <Th label="ตรงสเปก" sortKey="spec" sort={sort} onSort={toggleSort} />
                <Th label="อายุ" sortKey="age" className="hidden sm:table-cell" sort={sort} onSort={toggleSort} />
                <Th label="เงินเดือน" sortKey="salary" className="hidden sm:table-cell" sort={sort} onSort={toggleSort} />
                <Th label="ระยะทาง" sortKey="proximity" sort={sort} onSort={toggleSort} />
                <Th label="ประสบการณ์" className="hidden lg:table-cell" sort={sort} onSort={toggleSort} />
                <Th label="อุปกรณ์" className="hidden xl:table-cell" sort={sort} onSort={toggleSort} />
                <Th label="ไฟล์" className="hidden md:table-cell" sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const c = m.candidate;
                const prox = PROXIMITY[m.proximityTier] ?? PROXIMITY.unknown;
                return (
                  <tr
                    key={m.id}
                    onClick={() => setOpenId(m.id)}
                    className={`cursor-pointer border-b border-slate-100 transition-colors duration-150 last:border-b-0 ${
                      openId === m.id ? "bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="max-w-[220px] truncate px-3 py-2 font-medium text-slate-900">
                      {c.name}
                    </td>
                    {view === "ranked" && (
                      <td className="px-3 py-2">
                        <StarCell n={m.stars} />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <SpecCell met={m.specMet} total={m.specTotal} />
                    </td>
                    <td className="hidden px-3 py-2 tabular-nums text-slate-600 sm:table-cell">
                      {c.age ?? "—"}
                    </td>
                    <td className="hidden px-3 py-2 tabular-nums text-slate-600 sm:table-cell">
                      {c.expectedSalary ? c.expectedSalary.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs ${prox.className}`}
                      >
                        {prox.short}
                      </span>
                    </td>
                    <td className="hidden max-w-[260px] truncate px-3 py-2 text-slate-500 lg:table-cell">
                      {c.experienceText ?? "—"}
                    </td>
                    <td className="hidden px-3 py-2 xl:table-cell">
                      <span className="flex gap-1 text-slate-400">
                        {c.equipment.length === 0 && "—"}
                        {c.equipment.map((e) => {
                          const Icon = EQUIPMENT_ICON[e];
                          return Icon ? <Icon key={e} className="h-3.5 w-3.5" /> : null;
                        })}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2 md:table-cell">
                      <span className="flex gap-1.5 text-slate-400">
                        {c.resumeUrl && <FileText className="h-3.5 w-3.5" aria-label="มี Resume" />}
                        {c.portfolioUrl && (
                          <Briefcase className="h-3.5 w-3.5" aria-label="มี Portfolio" />
                        )}
                        {!c.resumeUrl && !c.portfolioUrl && "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-slate-500">
            ยังไม่มีใครถึงเกณฑ์นี้ — ลองลดจำนวนดาวลง
          </p>
        )}
      </div>

      {open && <DetailPanel row={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/** Detail for one row. Holds `why`, which is far too long to sit in a table cell. */
function DetailPanel({ row, onClose }: { row: MatchRow; onClose: () => void }) {
  const c = row.candidate;
  const prox = PROXIMITY[row.proximityTier] ?? PROXIMITY.unknown;

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/candidates/${c.id}`}
            className="cursor-pointer text-base font-medium text-slate-900 transition-colors duration-150 hover:text-blue-600"
          >
            {c.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {c.age && <span>{c.age} ปี</span>}
            {c.expectedSalary && <span>ขอ {c.expectedSalary.toLocaleString()}</span>}
            {c.maxSalesAmount && <span>ยอดขาย {c.maxSalesAmount.toLocaleString()}</span>}
            {c.phone && <span>{c.phone}</span>}
            <span className={`rounded px-1.5 py-0.5 ${prox.className}`}>{prox.short}</span>
          </div>
          {c.address && <p className="mt-1 text-xs text-slate-400">{c.address}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {row.filteredOut ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <Filter className="mr-1.5 inline h-3.5 w-3.5" />
          ตัดออก: {row.filterReason ?? "ไม่ผ่านเงื่อนไข"}
        </p>
      ) : row.noEvidence ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <HelpCircle className="mr-1.5 inline h-3.5 w-3.5" />
          ยังไม่มีข้อมูลพอให้ประเมิน — ควรถามเพิ่มก่อนตัดสิน
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-400">
            คะแนน {row.overallScore} · ข้อมูล {row.coveragePct}%
            {row.specTotal > 0 && ` · ตรงเงื่อนไข ${row.specMet}/${row.specTotal}`}
          </p>
          {row.why && <p className="mt-2 text-sm leading-relaxed text-slate-700">{row.why}</p>}
        </>
      )}

      {(c.resumeUrl || c.portfolioUrl) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {c.resumeUrl && (
            <a
              href={c.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 transition-colors duration-150 hover:bg-slate-50"
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
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 transition-colors duration-150 hover:bg-slate-50"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Portfolio
            </a>
          )}
        </div>
      )}
    </aside>
  );
}
