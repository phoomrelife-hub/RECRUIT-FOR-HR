"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Video, MapPin, Clock, ExternalLink, CalendarDays, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";

type InterviewEntry = {
  id: string;
  interviewDate: string; // ISO string
  startTime: string;
  interviewType: "ONLINE" | "ONSITE";
  location: string | null;
  meetingLink: string | null;
  candidateResponse: string | null;
  note: string | null;
  candidate: {
    id: string;
    fullName: string | null;
    nickname: string | null;
    lineDisplayName: string | null;
    lineProfilePicUrl: string | null;
    interestedPosition: { title: string } | null;
  };
};

interface Props {
  days: Record<string, InterviewEntry[]>;
  year: number;
  month: number; // 1-based
}

const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function toDateKey(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function todayKey() {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// ── Response badge ────────────────────────────────────────────────────────────
function ResponseBadge({ response }: { response: string | null }) {
  if (response === "confirmed")
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 border border-emerald-200">
        ✅ ยืนยันแล้ว
      </span>
    );
  if (response === "declined")
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 text-red-600 text-[10px] font-semibold px-2 py-0.5 border border-red-200">
        ❌ ไม่สะดวก
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold px-2 py-0.5 border border-slate-200">
      ⏳ รอยืนยัน
    </span>
  );
}

// ── Interview card ────────────────────────────────────────────────────────────
function InterviewCard({ iv }: { iv: InterviewEntry }) {
  const c = iv.candidate;
  const name = c.fullName ?? c.nickname ?? c.lineDisplayName ?? "ไม่ระบุชื่อ";
  const isOnline = iv.interviewType === "ONLINE";

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm hover:border-slate-300 transition-colors">
      {/* Time column */}
      <div className="shrink-0 flex flex-col items-center pt-0.5 min-w-[52px]">
        <div className="flex items-center gap-1 text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-sm font-semibold text-slate-700">{iv.startTime}</span>
        </div>
        <span className="text-[10px] text-slate-400 mt-0.5">น.</span>
      </div>

      {/* Divider */}
      <div className="w-px self-stretch bg-slate-100 shrink-0" />

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
          <div className="h-11 w-11 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center shrink-0">
            <span className="text-slate-500 font-semibold">{name.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900">{name}</span>
          <ResponseBadge response={iv.candidateResponse} />
          <span
            className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 border ${
              isOnline
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "bg-orange-50 text-orange-600 border-orange-200"
            }`}
          >
            {isOnline ? (
              <><Video className="h-2.5 w-2.5" /> ออนไลน์</>
            ) : (
              <><MapPin className="h-2.5 w-2.5" /> On-site</>
            )}
          </span>
        </div>

        {c.interestedPosition && (
          <p className="text-xs text-slate-500">💼 {c.interestedPosition.title}</p>
        )}

        {isOnline && iv.meetingLink && (
          <a
            href={iv.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            🔗 {iv.meetingLink.length > 50 ? iv.meetingLink.slice(0, 50) + "…" : iv.meetingLink}
          </a>
        )}

        {!isOnline && iv.location && (
          <p className="text-xs text-slate-500 flex items-start gap-1">
            <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-slate-400" />
            <span className="line-clamp-1">{iv.location}</span>
          </p>
        )}

        {iv.note && (
          <p className="text-xs text-slate-400 italic">📝 {iv.note}</p>
        )}
      </div>

      {/* Profile link */}
      <Link
        href={`/candidates/${c.id}`}
        target="_blank"
        className="shrink-0 self-center text-slate-400 hover:text-slate-600 transition-colors"
        title="เปิดโปรไฟล์"
      >
        <ExternalLink className="h-4 w-4" />
      </Link>
    </div>
  );
}

// ── Week helpers ─────────────────────────────────────────────────────────────

function getWeekDays(anchor: string): string[] {
  const [y, m, d] = anchor.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0=Sun
  const sunday = new Date(date);
  sunday.setDate(d - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(sunday);
    dd.setDate(sunday.getDate() + i);
    return toDateKey(dd.getFullYear(), dd.getMonth() + 1, dd.getDate());
  });
}

const THAI_DAY_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

// ── Week View ─────────────────────────────────────────────────────────────────
function WeekView({
  days,
  weekAnchor,
  today,
  onPrevWeek,
  onNextWeek,
  onSelectDay,
}: {
  days: Record<string, InterviewEntry[]>;
  weekAnchor: string;
  today: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSelectDay: (key: string) => void;
}) {
  const weekDays = getWeekDays(weekAnchor);
  const [wy, wm, wd] = weekDays[0].split("-").map(Number);
  const [ey, em, ed] = weekDays[6].split("-").map(Number);
  const rangeLabel =
    wm === em
      ? `${wd}–${ed} ${THAI_MONTHS_FULL[wm - 1]} ${wy + 543}`
      : `${wd} ${THAI_MONTHS_FULL[wm - 1]} – ${ed} ${THAI_MONTHS_FULL[em - 1]} ${wy + 543}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Week header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-800">สัปดาห์: {rangeLabel}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {weekDays.reduce((s, k) => s + (days[k]?.length ?? 0), 0)} นัดสัปดาห์นี้
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onPrevWeek} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={onNextWeek} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 7-column grid */}
      <div className="grid grid-cols-7 divide-x divide-slate-100">
        {weekDays.map((key, dow) => {
          const isToday = key === today;
          const interviews = days[key] ?? [];
          const [, , dayNum] = key.split("-").map(Number);
          const isWeekend = dow === 0 || dow === 6;

          return (
            <div
              key={key}
              className={`min-h-[120px] p-2 flex flex-col gap-1.5 cursor-pointer hover:bg-slate-50 transition-colors ${
                isToday ? "bg-emerald-50" : ""
              }`}
              onClick={() => onSelectDay(key)}
            >
              {/* Day header */}
              <div className="text-center pb-1 border-b border-slate-100">
                <p className={`text-[10px] font-semibold ${isWeekend ? "text-red-400" : "text-slate-400"}`}>
                  {THAI_DAY_FULL[dow].slice(0, 2)}
                </p>
                <p className={`text-sm font-bold leading-tight ${
                  isToday ? "text-emerald-700" : isWeekend ? "text-red-400" : "text-slate-700"
                }`}>
                  {dayNum}
                </p>
              </div>

              {/* Interview chips */}
              {interviews.length === 0 ? (
                <p className="text-[9px] text-slate-300 text-center mt-1">–</p>
              ) : (
                interviews.map((iv) => {
                  const name = iv.candidate.fullName ?? iv.candidate.nickname ?? iv.candidate.lineDisplayName ?? "?";
                  const isOnline = iv.interviewType === "ONLINE";
                  return (
                    <div
                      key={iv.id}
                      className={`rounded-md px-1.5 py-1 text-[9px] font-medium truncate border ${
                        isOnline
                          ? "bg-blue-50 text-blue-700 border-blue-100"
                          : "bg-orange-50 text-orange-700 border-orange-100"
                      }`}
                      title={`${iv.startTime} ${name}`}
                    >
                      <span className="opacity-70">{iv.startTime}</span> {name}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function CalendarClient({ days, year, month }: Props) {
  const today = todayKey();
  const [selectedKey, setSelectedKey] = useState<string>(today);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [weekAnchor, setWeekAnchor] = useState<string>(today);

  function prevWeek() {
    const [y, m, d] = weekAnchor.split("-").map(Number);
    const dt = new Date(y, m - 1, d - 7);
    setWeekAnchor(toDateKey(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()));
  }

  function nextWeek() {
    const [y, m, d] = weekAnchor.split("-").map(Number);
    const dt = new Date(y, m - 1, d + 7);
    setWeekAnchor(toDateKey(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()));
  }

  // Build calendar grid
  const { cells, daysInMonth } = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
    // Pad start with nulls
    const cells: (number | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // Pad end to complete last row
    while (cells.length % 7 !== 0) cells.push(null);
    return { cells, daysInMonth };
  }, [year, month]);

  const selectedInterviews = days[selectedKey] ?? [];

  // Format selected day label
  const [sy, sm, sd] = selectedKey.split("-").map(Number);
  const selectedLabel = `${sd} ${THAI_MONTHS_FULL[sm - 1]} ${sy + 543}`;
  const isSelectedToday = selectedKey === today;

  return (
    <div className="space-y-6">
      {/* ── View toggle ── */}
      <div className="flex justify-end">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          <button
            onClick={() => setViewMode("month")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "month"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            เดือน
          </button>
          <button
            onClick={() => { setViewMode("week"); setWeekAnchor(selectedKey); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "week"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            สัปดาห์
          </button>
        </div>
      </div>

      {/* ── Month Grid ── */}
      {viewMode === "month" && (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Month header */}
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">
            {THAI_MONTHS_FULL[month - 1]} {year + 543}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {Object.keys(days).length > 0
              ? `มีนัด ${Object.values(days).reduce((s, v) => s + v.length, 0)} รายการเดือนนี้`
              : "ไม่มีนัดสัมภาษณ์เดือนนี้"}
          </p>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={`py-2 text-center text-xs font-semibold ${
                i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="h-14 border-b border-r border-slate-50 last:border-r-0" />;
            }

            const key = toDateKey(year, month, day);
            const isToday = key === today;
            const isSelected = key === selectedKey;
            const hasInterviews = !!days[key]?.length;
            const count = days[key]?.length ?? 0;

            const col = idx % 7;
            const isLastCol = col === 6;
            const isLastRow = idx >= cells.length - 7;

            return (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                className={`relative h-14 flex flex-col items-center justify-center gap-0.5 transition-all
                  border-b border-r border-slate-100
                  ${isLastCol ? "border-r-0" : ""}
                  ${isLastRow ? "border-b-0" : ""}
                  ${isSelected && !isToday ? "ring-2 ring-inset ring-slate-400 bg-slate-50" : ""}
                  ${isSelected && isToday ? "ring-2 ring-inset ring-emerald-500" : ""}
                  ${isToday ? "bg-emerald-50" : "hover:bg-slate-50"}
                `}
              >
                <span
                  className={`text-sm font-semibold leading-none ${
                    isToday
                      ? "text-emerald-700"
                      : col === 0
                      ? "text-red-400"
                      : col === 6
                      ? "text-blue-400"
                      : "text-slate-700"
                  }`}
                >
                  {day}
                </span>

                {hasInterviews && (
                  <span
                    className={`inline-flex items-center justify-center rounded-full text-[9px] font-bold min-w-[16px] h-4 px-1 ${
                      isToday
                        ? "bg-emerald-600 text-white"
                        : "bg-violet-100 text-violet-700"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* ── Week View ── */}
      {viewMode === "week" && (
        <WeekView
          days={days}
          weekAnchor={weekAnchor}
          today={today}
          onPrevWeek={prevWeek}
          onNextWeek={nextWeek}
          onSelectDay={(k) => { setSelectedKey(k); setWeekAnchor(k); }}
        />
      )}

      {/* ── Daily Detail ── */}
      <div className="space-y-3">
        {/* Section header */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-xl px-4 py-2 border ${
            isSelectedToday
              ? "bg-emerald-50 border-emerald-200"
              : "bg-slate-50 border-slate-200"
          }`}>
            <span className={`text-sm font-bold ${isSelectedToday ? "text-emerald-700" : "text-slate-700"}`}>
              {isSelectedToday ? "📅 วันนี้ — " : "📅 "}{selectedLabel}
            </span>
            {selectedInterviews.length > 0 && (
              <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                isSelectedToday ? "bg-emerald-200 text-emerald-800" : "bg-violet-100 text-violet-700"
              }`}>
                {selectedInterviews.length} นัด
              </span>
            )}
          </div>
        </div>

        {/* Cards */}
        {selectedInterviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
            <p className="text-sm text-slate-400">ไม่มีนัดสัมภาษณ์ในวันนี้</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedInterviews.map((iv) => (
              <InterviewCard key={iv.id} iv={iv} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
