export default function ReviewLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-7 w-40 rounded bg-slate-200" />
        <div className="mt-1 h-4 w-52 rounded bg-slate-100" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-slate-100 pb-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-9 w-28 rounded-t-lg ${i === 0 ? "bg-slate-200" : "bg-slate-100"}`} />
        ))}
      </div>

      {/* Candidate cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
            {/* Profile row */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="h-3 w-24 rounded bg-slate-100" />
              </div>
              <div className="h-6 w-16 rounded-full bg-slate-100" />
            </div>
            {/* Info rows */}
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-3 w-20 rounded bg-slate-100" />
                  <div className="h-3 w-28 rounded bg-slate-200" />
                </div>
              ))}
            </div>
            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <div className="h-8 flex-1 rounded-lg bg-slate-100" />
              <div className="h-8 flex-1 rounded-lg bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
