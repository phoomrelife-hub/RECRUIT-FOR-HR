export default function JobsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-32 rounded bg-slate-200" />
        <div className="mt-1 h-4 w-48 rounded bg-slate-100" />
      </div>
      <div className="flex justify-end">
        <div className="h-9 w-32 rounded-lg bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-36 rounded bg-slate-200" />
              <div className="h-5 w-14 rounded-full bg-slate-100" />
            </div>
            <div className="h-3.5 w-24 rounded bg-slate-100" />
            <div className="flex gap-2 pt-1">
              <div className="h-4 w-16 rounded bg-slate-100" />
              <div className="h-4 w-16 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
