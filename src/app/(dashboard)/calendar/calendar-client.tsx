"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Video, MapPin, Clock, CalendarDays, LayoutGrid,
  ChevronLeft, ChevronRight, Trash2, Copy, Check,
  MessageSquare, User, Loader2, Phone, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

type InterviewEntry = {
  id: string;
  interviewDate: string; // ISO string
  startTime: string;
  endTime: string;
  interviewType: "ONLINE" | "ONSITE" | "PHONE";
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
    conversations: { id: string }[];
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

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function todayKey() {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// ── Month/Year Picker Popover ─────────────────────────────────────────────────
function MonthYearPicker({
  year, month, onSelect,
}: {
  year: number;
  month: number;
  onSelect: (y: number, m: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const nowYear = new Date().getFullYear();

  return (
    <div className="relative">
      <button
        onClick={() => { setPickerYear(year); setOpen((v) => !v); }}
        className="flex items-center gap-1 text-base font-bold text-slate-800 hover:text-blue-600 transition-colors"
      >
        {THAI_MONTHS_FULL[month - 1]} {year + 543}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-20 w-64 rounded-xl border border-slate-200 bg-white shadow-lg p-3">
            {/* Year selector */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setPickerYear((y) => y - 1)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-slate-700">{pickerYear + 543}</span>
              <button
                onClick={() => setPickerYear((y) => y + 1)}
                disabled={pickerYear >= nowYear + 1}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {/* Month grid */}
            <div className="grid grid-cols-3 gap-1">
              {THAI_MONTHS_SHORT.map((label, i) => {
                const m = i + 1;
                const isActive = pickerYear === year && m === month;
                const isNow = pickerYear === nowYear && m === new Date().getMonth() + 1;
                return (
                  <button
                    key={m}
                    onClick={() => { onSelect(pickerYear, m); setOpen(false); }}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-colors
                      ${isActive ? "bg-blue-600 text-white" : isNow ? "bg-blue-50 text-blue-700 border border-blue-200" : "hover:bg-slate-100 text-slate-600"}
                    `}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
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
function InterviewCard({
  iv,
  onDeleted,
}: {
  iv: InterviewEntry;
  onDeleted: (id: string) => void;
}) {
  const c = iv.candidate;
  const name = c.fullName ?? c.nickname ?? c.lineDisplayName ?? "ไม่ระบุชื่อ";
  const isOnline = iv.interviewType === "ONLINE";
  const isPhone = iv.interviewType === "PHONE";
  const conversationId = c.conversations?.[0]?.id ?? null;

  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleDelete() {
    if (!confirm(`ต้องการลบนัดสัมภาษณ์ของ "${name}" วันที่ ${iv.startTime} น. ใช่ไหม?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/interviews/${iv.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) { toast.error("ลบไม่สำเร็จ"); return; }
    toast.success(`ลบนัดสัมภาษณ์ "${name}" แล้ว`);
    onDeleted(iv.id);
  }

  function handleCopy() {
    if (!iv.meetingLink) return;
    navigator.clipboard.writeText(iv.meetingLink).then(() => {
      setCopied(true);
      toast.success("Copy link แล้ว");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const typeIcon = isOnline
    ? <Video className="h-3 w-3" />
    : isPhone
    ? <Phone className="h-3 w-3" />
    : <MapPin className="h-3 w-3" />;

  const typeBadgeClass = isOnline
    ? "bg-blue-50 text-blue-600 border-blue-200"
    : isPhone
    ? "bg-purple-50 text-purple-600 border-purple-200"
    : "bg-orange-50 text-orange-600 border-orange-200";

  const typeLabel = isOnline ? "ออนไลน์" : isPhone ? "โทรศัพท์" : "On-site";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:border-slate-300 transition-colors">
      {/* Main info row */}
      <div className="flex items-start gap-4 px-5 py-4">
        {/* Time */}
        <div className="shrink-0 flex flex-col items-center pt-0.5 min-w-[52px]">
          <div className="flex items-center gap-1 text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-sm font-bold text-slate-700">{iv.startTime}</span>
          </div>
          {iv.endTime && (
            <span className="text-[10px] text-slate-400 mt-0.5">– {iv.endTime}</span>
          )}
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
            <div className="h-11 w-11 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
              <span className="text-slate-500 font-semibold text-sm">{name.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{name}</span>
            <ResponseBadge response={iv.candidateResponse} />
            <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 border ${typeBadgeClass}`}>
              {typeIcon} {typeLabel}
            </span>
          </div>

          {c.interestedPosition && (
            <p className="text-xs text-slate-500">💼 {c.interestedPosition.title}</p>
          )}

          {isOnline && iv.meetingLink && (
            <p className="text-xs text-slate-400 truncate max-w-sm">
              🔗 {iv.meetingLink.length > 55 ? iv.meetingLink.slice(0, 55) + "…" : iv.meetingLink}
            </p>
          )}

          {!isOnline && !isPhone && iv.location && (
            <p className="text-xs text-slate-500 flex items-start gap-1">
              <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-slate-400" />
              <span className="line-clamp-1">{iv.location}</span>
            </p>
          )}

          {iv.note && (
            <p className="text-xs text-slate-400 italic line-clamp-1">📝 {iv.note}</p>
          )}
        </div>
      </div>

      {/* ── Quick Actions bar ── */}
      <div className="flex items-center gap-1 px-4 py-2 bg-slate-50 border-t border-slate-100">
        {/* Profile */}
        <Link
          href={`/candidates/${c.id}`}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm border border-transparent hover:border-slate-200 transition-all"
        >
          <User className="h-3.5 w-3.5" />
          โปรไฟล์
        </Link>

        {/* Chat / Inbox */}
        <Link
          href={conversationId ? `/inbox?c=${conversationId}` : `/inbox`}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm border border-transparent hover:border-slate-200 transition-all"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          แชท
        </Link>

        {/* Copy Meeting Link — online only */}
        {isOnline && iv.meetingLink && (
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border ${
              copied
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm border-transparent hover:border-slate-200"
            }`}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        )}

        {/* Open meeting link directly */}
        {isOnline && iv.meetingLink && (
          <a
            href={iv.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-800 border border-transparent hover:border-blue-200 transition-all"
          >
            <Video className="h-3.5 w-3.5" />
            เปิด Meet
          </a>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="ลบนัดสัมภาษณ์"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-transparent transition-all disabled:opacity-50"
        >
          {deleting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
          {deleting ? "กำลังลบ…" : "ลบนัด"}
        </button>
      </div>
    </div>
  );
}

// ── Week helpers ──────────────────────────────────────────────────────────────
function getWeekDays(anchor: string): string[] {
  const [y, m, d] = anchor.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
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
  const [, em, ed] = weekDays[6].split("-").map(Number);
  const rangeLabel =
    wm === em
      ? `${wd}–${ed} ${THAI_MONTHS_FULL[wm - 1]} ${wy + 543}`
      : `${wd} ${THAI_MONTHS_FULL[wm - 1]} – ${ed} ${THAI_MONTHS_FULL[em - 1]} ${wy + 543}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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

      <div className="grid grid-cols-7 divide-x divide-slate-100">
        {weekDays.map((key, dow) => {
          const isToday = key === today;
          const interviews = days[key] ?? [];
          const [, , dayNum] = key.split("-").map(Number);
          const isWeekend = dow === 0 || dow === 6;

          return (
            <div
              key={key}
              className={`min-h-[120px] p-2 flex flex-col gap-1.5 cursor-pointer hover:bg-slate-50 transition-colors ${isToday ? "bg-emerald-50" : ""}`}
              onClick={() => onSelectDay(key)}
            >
              <div className="text-center pb-1 border-b border-slate-100">
                <p className={`text-[10px] font-semibold ${isWeekend ? "text-red-400" : "text-slate-400"}`}>
                  {THAI_DAY_FULL[dow].slice(0, 2)}
                </p>
                <p className={`text-sm font-bold leading-tight ${isToday ? "text-emerald-700" : isWeekend ? "text-red-400" : "text-slate-700"}`}>
                  {dayNum}
                </p>
              </div>

              {interviews.length === 0 ? (
                <p className="text-[9px] text-slate-300 text-center mt-1">–</p>
              ) : (
                interviews.map((iv) => {
                  const cname = iv.candidate.fullName ?? iv.candidate.nickname ?? iv.candidate.lineDisplayName ?? "?";
                  const isOnline = iv.interviewType === "ONLINE";
                  return (
                    <div
                      key={iv.id}
                      className={`rounded-md px-1.5 py-1 text-[9px] font-medium truncate border ${
                        isOnline
                          ? "bg-blue-50 text-blue-700 border-blue-100"
                          : "bg-orange-50 text-orange-700 border-orange-100"
                      }`}
                      title={`${iv.startTime} ${cname}`}
                    >
                      <span className="opacity-70">{iv.startTime}</span> {cname}
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
export function CalendarClient({ days: initialDays, year, month }: Props) {
  const today = todayKey();
  const [curYear, setCurYear] = useState(year);
  const [curMonth, setCurMonth] = useState(month);
  const [days, setDays] = useState<Record<string, InterviewEntry[]>>(initialDays);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>(today);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [weekAnchor, setWeekAnchor] = useState<string>(today);

  async function navigateMonth(deltaMonths: number) {
    const dt = new Date(curYear, curMonth - 1 + deltaMonths, 1);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const monthStr = `${y}-${String(m).padStart(2, "0")}`;
    setLoadingMonth(true);
    try {
      const res = await fetch(`/api/calendar/interviews?month=${monthStr}`);
      const data = await res.json();
      setDays(data.days ?? {});
      setCurYear(y);
      setCurMonth(m);
      // select first day of new month
      setSelectedKey(toDateKey(y, m, 1));
    } catch {
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoadingMonth(false);
    }
  }

  // Remove a deleted interview from local state
  const handleDeleted = useCallback((interviewId: string) => {
    setDays((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        const filtered = next[key].filter((iv) => iv.id !== interviewId);
        if (filtered.length === 0) {
          delete next[key];
        } else {
          next[key] = filtered;
        }
      }
      return next;
    });
  }, []);

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
  const { cells } = useMemo(() => {
    const daysInMonth = new Date(curYear, curMonth, 0).getDate();
    const firstDow = new Date(curYear, curMonth - 1, 1).getDay();
    const cells: (number | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return { cells };
  }, [curYear, curMonth]);

  const selectedInterviews = days[selectedKey] ?? [];

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
              viewMode === "month" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            เดือน
          </button>
          <button
            onClick={() => { setViewMode("week"); setWeekAnchor(selectedKey); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "week" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
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
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <MonthYearPicker
                year={curYear}
                month={curMonth}
                onSelect={async (y, m) => {
                  const delta = (y - curYear) * 12 + (m - curMonth);
                  if (delta === 0) return;
                  await navigateMonth(delta);
                }}
              />
              <p className="text-xs text-slate-400 mt-0.5">
                {loadingMonth ? "กำลังโหลด..." : Object.keys(days).length > 0
                  ? `มีนัด ${Object.values(days).reduce((s, v) => s + v.length, 0)} รายการเดือนนี้`
                  : "ไม่มีนัดสัมภาษณ์เดือนนี้"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateMonth(-1)}
                disabled={loadingMonth}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={async () => {
                  const now = new Date();
                  const ty = now.getFullYear(), tm = now.getMonth() + 1;
                  if (curYear === ty && curMonth === tm) { setSelectedKey(today); return; }
                  const delta = (ty - curYear) * 12 + (tm - curMonth);
                  await navigateMonth(delta);
                  setSelectedKey(today);
                }}
                disabled={loadingMonth}
                className="px-2 py-1 rounded-md text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                {loadingMonth ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "วันนี้"}
              </button>
              <button
                onClick={() => navigateMonth(1)}
                disabled={loadingMonth}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100">
            {DAY_LABELS.map((d, i) => (
              <div key={d} className={`py-2 text-center text-xs font-semibold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400"}`}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="h-14 border-b border-r border-slate-50 last:border-r-0" />;
              }
              const key = toDateKey(curYear, curMonth, day);
              const isToday = key === today;
              const isSelected = key === selectedKey;
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
                  <span className={`text-sm font-semibold leading-none ${isToday ? "text-emerald-700" : col === 0 ? "text-red-400" : col === 6 ? "text-blue-400" : "text-slate-700"}`}>
                    {day}
                  </span>
                  {count > 0 && (
                    <span className={`inline-flex items-center justify-center rounded-full text-[9px] font-bold min-w-[16px] h-4 px-1 ${isToday ? "bg-emerald-600 text-white" : "bg-violet-100 text-violet-700"}`}>
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
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-xl px-4 py-2 border ${
            isSelectedToday ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"
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

        {selectedInterviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
            <p className="text-sm text-slate-400">ไม่มีนัดสัมภาษณ์ในวันนี้</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedInterviews.map((iv) => (
              <InterviewCard key={iv.id} iv={iv} onDeleted={handleDeleted} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
