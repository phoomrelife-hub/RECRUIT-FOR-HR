"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import {
  STAGE_ORDER,
  type KanbanCandidate,
  type PipelineStatus,
} from "./pipeline-config";

type Props = {
  initialCandidates: KanbanCandidate[];
  jobs: { id: string; title: string }[];
  userRole: string;
};

function groupByStatus(candidates: KanbanCandidate[]) {
  const groups: Record<string, KanbanCandidate[]> = {};
  for (const stage of STAGE_ORDER) {
    groups[stage] = [];
  }
  for (const c of candidates) {
    if (groups[c.currentStatus]) {
      groups[c.currentStatus].push(c);
    }
  }
  return groups;
}

export function PipelineClient({ initialCandidates, jobs }: Props) {
  const [candidates, setCandidates] = useState<KanbanCandidate[]>(initialCandidates);
  const [selectedJobId, setSelectedJobId] = useState<string>("ALL");
  const [activeCandidate, setActiveCandidate] = useState<KanbanCandidate | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const filteredCandidates =
    selectedJobId === "ALL"
      ? candidates
      : candidates.filter((c) => c.interestedPosition?.id === selectedJobId);

  const groups = groupByStatus(filteredCandidates);

  const handleJobFilter = useCallback(async (jobId: string) => {
    setSelectedJobId(jobId);
    setIsRefreshing(true);
    try {
      const url =
        jobId === "ALL" ? "/api/pipeline" : `/api/pipeline?jobPositionId=${jobId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data: KanbanCandidate[] = await res.json();
      setCandidates(data);
    } catch {
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const url =
        selectedJobId === "ALL"
          ? "/api/pipeline"
          : `/api/pipeline?jobPositionId=${selectedJobId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data: KanbanCandidate[] = await res.json();
      setCandidates(data);
    } catch {
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedJobId]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const candidate = event.active.data.current?.candidate as KanbanCandidate;
    setActiveCandidate(candidate ?? null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveCandidate(null);
      const { active, over } = event;
      if (!over) return;

      const fromStatus = active.data.current?.status as PipelineStatus;
      const toStatus = over.id as PipelineStatus;
      if (fromStatus === toStatus) return;

      const candidateId = active.id as string;

      // Optimistic update
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId ? { ...c, currentStatus: toStatus } : c
        )
      );

      try {
        const res = await fetch(`/api/candidates/${candidateId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentStatus: toStatus }),
        });
        if (!res.ok) throw new Error();
        toast.success("อัปเดตสถานะเรียบร้อย");
      } catch {
        // Revert optimistic update
        setCandidates((prev) =>
          prev.map((c) =>
            c.id === candidateId ? { ...c, currentStatus: fromStatus } : c
          )
        );
        toast.error("อัปเดตสถานะไม่สำเร็จ");
      }
    },
    []
  );

  const totalCount = filteredCandidates.length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6 overflow-hidden">
      {/* Page header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              ภาพรวม Kanban Board — {totalCount} ผู้สมัคร
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Select
              value={selectedJobId}
              onValueChange={(v) => v && handleJobFilter(v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="ทุกตำแหน่ง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกตำแหน่ง</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="รีเฟรช"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className="flex gap-3 p-4 h-full"
            style={{ minWidth: `${STAGE_ORDER.length * 272 + (STAGE_ORDER.length - 1) * 12 + 32}px` }}
          >
            {STAGE_ORDER.map((status) => (
              <div key={status} className="flex flex-col" style={{ height: "calc(100vh - 4rem - 90px - 2rem)" }}>
                <KanbanColumn
                  status={status}
                  candidates={groups[status] ?? []}
                />
              </div>
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeCandidate ? (
              <KanbanCard candidate={activeCandidate} isOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
