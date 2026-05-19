export default function CandidatesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-7 w-36 rounded bg-slate-200" />
        <div className="mt-1 h-4 w-48 rounded bg-slate-100" />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="h-9 flex-1 max-w-sm rounded-lg bg-slate-100" />
        <div className="h-9 w-28 rounded-lg bg-slate-100" />
        <div className="h-9 w-28 rounded-lg bg-slate-100" />
        <div className="ml-auto h-9 w-24 rounded-lg bg-slate-200" />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-3">
          {[40, 120, 80, 90, 80, 100, 70].map((w, i) => (
            <div key={i} className="h-3 rounded bg-slate-200" style={{ width: w }} />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-50 px-4 py-3.5">
            <div className="h-8 w-8 shrink-0 rounded-full bg-slate-100" />
            <div className="h-3.5 w-28 rounded bg-slate-200" />
            <div className="h-3.5 w-20 rounded bg-slate-100" />
            <div className="h-3.5 w-24 rounded bg-slate-100" />
            <div className="h-5 w-20 rounded-full bg-slate-100" />
            <div className="h-5 w-16 rounded-full bg-slate-100" />
            <div className="h-3.5 w-16 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-slate-100" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-8 rounded bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
