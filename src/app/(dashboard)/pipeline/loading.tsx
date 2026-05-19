export default function PipelineLoading() {
  const columns = ["ใหม่", "คัดกรอง", "สัมภาษณ์", "Shortlist", "เสนองาน"];

  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-7 w-32 rounded bg-slate-200" />
        <div className="mt-1 h-4 w-44 rounded bg-slate-100" />
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-hidden">
        {columns.map((_, i) => (
          <div key={i} className="w-64 shrink-0 space-y-3">
            {/* Column header */}
            <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2">
              <div className="h-3.5 w-20 rounded bg-slate-200" />
              <div className="h-5 w-6 rounded-full bg-slate-200" />
            </div>
            {/* Cards */}
            {Array.from({ length: 3 + (i % 3) }).map((_, j) => (
              <div key={j} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-24 rounded bg-slate-200" />
                    <div className="h-3 w-16 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-5 w-20 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
