export default function CandidateProfileLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back button */}
      <div className="h-8 w-28 rounded-lg bg-slate-100" />

      {/* Profile card */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-5">
          <div className="h-16 w-16 shrink-0 rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-44 rounded bg-slate-200" />
            <div className="h-4 w-28 rounded bg-slate-100" />
            <div className="flex gap-2 pt-1">
              <div className="h-5 w-20 rounded-full bg-slate-100" />
              <div className="h-5 w-16 rounded-full bg-slate-100" />
            </div>
          </div>
          <div className="h-8 w-28 rounded-lg bg-slate-100" />
        </div>
      </div>

      {/* Two-col grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: info + notes */}
        <div className="space-y-5 lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-3.5 w-full rounded bg-slate-100" />
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Right: sidebar */}
        <div className="space-y-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-3.5 w-3/4 rounded bg-slate-100" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
