export default function InboxLoading() {
  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden animate-pulse">
      {/* Conversation list sidebar */}
      <div className="w-80 shrink-0 border-r border-slate-100 flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-slate-100">
          <div className="h-9 w-full rounded-lg bg-slate-100" />
        </div>
        {/* Conversation items */}
        <div className="flex-1 overflow-hidden divide-y divide-slate-50">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-3.5 w-28 rounded bg-slate-200" />
                  <div className="h-3 w-10 rounded bg-slate-100" />
                </div>
                <div className="h-3 w-40 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message pane */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="h-10 w-10 rounded-full bg-slate-200" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-100" />
          </div>
        </div>
        {/* Messages */}
        <div className="flex-1 p-5 space-y-4">
          {[false, true, false, false, true, false].map((right, i) => (
            <div key={i} className={`flex ${right ? "justify-end" : "justify-start"}`}>
              <div
                className={`h-10 rounded-2xl bg-slate-${right ? "200" : "100"}`}
                style={{ width: `${120 + (i % 3) * 60}px` }}
              />
            </div>
          ))}
        </div>
        {/* Input */}
        <div className="border-t border-slate-100 p-4">
          <div className="h-10 w-full rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
