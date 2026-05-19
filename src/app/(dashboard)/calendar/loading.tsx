export default function CalendarLoading() {
  const days = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-36 rounded bg-slate-200" />
          <div className="mt-1 h-4 w-44 rounded bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-9 rounded-lg bg-slate-100" />
          <div className="h-9 w-32 rounded-lg bg-slate-200" />
          <div className="h-9 w-9 rounded-lg bg-slate-100" />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {days.map((d, i) => (
            <div key={i} className="py-3 flex justify-center">
              <div className="h-3.5 w-6 rounded bg-slate-200" />
            </div>
          ))}
        </div>
        {/* Weeks */}
        {Array.from({ length: 5 }).map((_, week) => (
          <div key={week} className="grid grid-cols-7 border-b border-slate-50 last:border-0">
            {Array.from({ length: 7 }).map((_, day) => (
              <div key={day} className="min-h-[100px] border-r border-slate-50 last:border-0 p-2 space-y-1">
                <div className="h-6 w-6 rounded-full bg-slate-100" />
                {/* Occasional event placeholders */}
                {(week + day) % 4 === 0 && (
                  <div className="h-6 w-full rounded bg-slate-200" />
                )}
                {(week * day) % 5 === 0 && (
                  <div className="h-6 w-4/5 rounded bg-slate-100" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
