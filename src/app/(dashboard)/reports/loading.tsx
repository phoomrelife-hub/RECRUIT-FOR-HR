export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-28 rounded bg-slate-200" />
        <div className="mt-1 h-4 w-48 rounded bg-slate-100" />
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-2">
            <div className="h-3.5 w-20 rounded bg-slate-100" />
            <div className="h-8 w-14 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="h-4 w-32 rounded bg-slate-200 mb-4" />
            <div className="h-52 w-full rounded-xl bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
