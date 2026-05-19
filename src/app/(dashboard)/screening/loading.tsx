export default function ScreeningLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-44 rounded bg-slate-200" />
        <div className="mt-1 h-4 w-56 rounded bg-slate-100" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded bg-slate-200" />
              <div className="h-3.5 w-24 rounded bg-slate-100" />
            </div>
            <div className="h-8 w-20 rounded-lg bg-slate-100" />
            <div className="h-8 w-20 rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
