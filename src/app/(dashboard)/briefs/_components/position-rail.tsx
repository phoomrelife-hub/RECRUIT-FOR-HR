"use client";

import { Check, Circle } from "lucide-react";
import type { PositionRow } from "../briefs-workbench";

/**
 * The position list.
 *
 * Ordered by waiting count, and the count is the loudest thing on each row —
 * with 757 of ~860 waiting candidates on one position, an even-weight list would
 * be actively misleading about where the work is.
 */
export function PositionRail({
  positions,
  selectedId,
  onSelect,
}: {
  positions: PositionRow[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const withBrief = positions.filter((p) => p.brief).length;

  return (
    <nav aria-label="ตำแหน่งที่เปิดรับ" className="lg:sticky lg:top-20 lg:self-start">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <span className="text-xs font-medium text-slate-500">
          {positions.length} ตำแหน่งที่เปิดรับ
        </span>
        <span className="text-xs tabular-nums text-slate-400">มีบรีฟ {withBrief}</span>
      </div>

      <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {positions.map((p) => {
          const active = p.id === selectedId;
          return (
            <li key={p.id} className="border-b border-slate-100 last:border-b-0">
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                aria-current={active ? "true" : undefined}
                className={`group flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                  active ? "bg-blue-50" : "hover:bg-slate-50"
                }`}
              >
                {/* Brief present / absent, as shape not just colour. */}
                {p.brief ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-label="มีบรีฟแล้ว" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-label="ยังไม่มีบรีฟ" />
                )}

                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    active ? "font-medium text-blue-900" : "text-slate-700"
                  }`}
                  title={p.title}
                >
                  {p.title}
                </span>

                {p.waiting > 0 && (
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${
                      p.waiting >= 100
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                    title={`${p.waiting} คนรอพิจารณา`}
                  >
                    {p.waiting}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 px-1 text-[11px] leading-relaxed text-slate-400">
        ตัวเลขคือจำนวนผู้สมัครที่รอพิจารณา
      </p>
    </nav>
  );
}
