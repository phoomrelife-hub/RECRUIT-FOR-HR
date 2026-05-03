"use client";

import { useDroppable } from "@dnd-kit/core";
import { KanbanCard } from "./kanban-card";
import { STAGE_CONFIG, type KanbanCandidate, type PipelineStatus } from "./pipeline-config";

type Props = {
  status: PipelineStatus;
  candidates: KanbanCandidate[];
};

export function KanbanColumn({ status, candidates }: Props) {
  const config = STAGE_CONFIG[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-64 flex-shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50 overflow-hidden h-full">
      {/* Colored top bar */}
      <div className={`h-1 w-full ${config.headerBg}`} />

      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-b border-slate-200">
        <span className="flex-1 text-sm font-semibold text-slate-700 truncate">
          {config.label}
        </span>
        <span
          className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${config.countBg}`}
        >
          {candidates.length}
        </span>
      </div>

      {/* Card list */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-24 transition-colors ${
          isOver ? "bg-blue-50" : ""
        }`}
      >
        {candidates.map((candidate) => (
          <KanbanCard key={candidate.id} candidate={candidate} />
        ))}

        {candidates.length === 0 && (
          <div
            className={`flex h-16 items-center justify-center rounded-md border-2 border-dashed text-xs text-slate-400 transition-colors ${
              isOver ? "border-blue-300 bg-blue-50" : "border-slate-200"
            }`}
          >
            {isOver ? "วางที่นี่" : "ไม่มีผู้สมัคร"}
          </div>
        )}
      </div>
    </div>
  );
}
