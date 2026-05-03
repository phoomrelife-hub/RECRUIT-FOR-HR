"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { Phone, GripVertical } from "lucide-react";
import { type KanbanCandidate } from "./pipeline-config";

type Props = {
  candidate: KanbanCandidate;
  isOverlay?: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  LINE: "LINE",
  FACEBOOK: "FB",
  MANUAL: "Manual",
  OTHER: "Other",
};

const SOURCE_COLOR: Record<string, string> = {
  LINE: "bg-green-100 text-green-700",
  FACEBOOK: "bg-blue-100 text-blue-700",
  MANUAL: "bg-slate-100 text-slate-600",
  OTHER: "bg-gray-100 text-gray-600",
};

export function KanbanCard({ candidate, isOverlay }: Props) {
  const router = useRouter();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
    data: { status: candidate.currentStatus, candidate },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const displayName = candidate.fullName || candidate.nickname || candidate.phone || "ไม่ระบุชื่อ";
  const assignee = candidate.assignments[0]?.assignedTo;
  const visibleTags = candidate.tags.slice(0, 2);
  const extraTagCount = candidate.tags.length - 2;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-md border bg-white p-3 shadow-sm transition-shadow select-none ${
        isDragging ? "opacity-40 shadow-md" : "hover:shadow-md"
      } ${isOverlay ? "rotate-1 shadow-lg cursor-grabbing" : "cursor-grab"}`}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-slate-400" />
      </div>

      {/* Click area for navigation */}
      <div
        onClick={() => !isDragging && router.push(`/candidates/${candidate.id}`)}
        className="cursor-pointer"
      >
        {/* Name + source */}
        <div className="flex items-start gap-1.5 pr-5">
          <span className="flex-1 text-sm font-semibold text-slate-800 leading-tight line-clamp-1">
            {displayName}
          </span>
          <span
            className={`mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              SOURCE_COLOR[candidate.sourceChannel] ?? SOURCE_COLOR.OTHER
            }`}
          >
            {SOURCE_LABEL[candidate.sourceChannel] ?? "Other"}
          </span>
        </div>

        {/* Position */}
        {candidate.interestedPosition && (
          <p className="mt-1 text-xs text-slate-500 line-clamp-1">
            {candidate.interestedPosition.title}
          </p>
        )}

        {/* Phone */}
        {candidate.phone && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span>{candidate.phone}</span>
          </div>
        )}

        {/* Tags + Assignee */}
        {(visibleTags.length > 0 || assignee) && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            {visibleTags.map(({ tag }) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
            {extraTagCount > 0 && (
              <span className="text-[10px] text-slate-400">+{extraTagCount}</span>
            )}

            {assignee && (
              <div
                className="ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white"
                title={assignee.name ?? ""}
              >
                {(assignee.name ?? "?")[0].toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
