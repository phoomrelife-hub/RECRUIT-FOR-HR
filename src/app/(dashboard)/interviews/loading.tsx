export default function InterviewsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-40 rounded bg-slate-200" />
        <div className="mt-1 h-4 w-52 rounded bg-slate-100" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-2">
            <div className="h-3.5 w-20 rounded bg-slate-100" />
            <div className="h-7 w-12 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      {/* Interview list */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-50 px-5 py-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="h-3 w-24 rounded bg-slate-100" />
            </div>
            <div className="h-5 w-20 rounded-full bg-slate-100" />
            <div className="h-5 w-16 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
