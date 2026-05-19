export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 h-3 w-24 rounded bg-slate-100" />
            <div className="mb-1 h-7 w-16 rounded bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Chart + funnel row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 h-4 w-32 rounded bg-slate-200" />
          <div className="h-48 w-full rounded-xl bg-slate-100" />
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 h-4 w-28 rounded bg-slate-200" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 flex-1 rounded bg-slate-100" style={{ opacity: 1 - i * 0.15 }} />
                <div className="h-3 w-8 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interviews + candidates row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 h-4 w-36 rounded bg-slate-200" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-28 rounded bg-slate-200" />
                    <div className="h-2.5 w-20 rounded bg-slate-100" />
                  </div>
                  <div className="h-5 w-14 rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
