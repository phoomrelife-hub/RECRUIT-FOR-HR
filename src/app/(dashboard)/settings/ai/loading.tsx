export default function SettingsAiLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-36 rounded bg-slate-200" />
        <div className="mt-1 h-4 w-56 rounded bg-slate-100" />
      </div>
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-t-lg bg-slate-100" />
        ))}
      </div>
      {/* Content */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
            <div className="h-4 w-40 rounded bg-slate-200" />
            <div className="h-3.5 w-full rounded bg-slate-100" />
            <div className="h-3.5 w-3/4 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
