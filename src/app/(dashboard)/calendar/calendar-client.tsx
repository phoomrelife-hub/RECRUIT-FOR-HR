"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Video, MapPin, Clock, ExternalLink } from "lucide-react";

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

// ── Main Component ────────────────────────────────────────────────────────────
export function CalendarClient({ days, year, month }: Props) {
  const today = todayKey();
  const [selectedKey, setSelectedKey] = useState<string>(today);

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
      {/* ── Month Grid ── */}
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

            // Col position for border logic
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
                {/* Day number */}
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

                {/* Interview dot / count */}
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
