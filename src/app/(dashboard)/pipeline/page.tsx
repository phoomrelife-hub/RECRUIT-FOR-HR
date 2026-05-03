import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PipelineClient } from "./pipeline-client";

export default async function PipelinePage() {
  const session = await auth();

  const [candidates, jobs] = await Promise.all([
    db.candidate.findMany({
      select: {
        id: true,
        fullName: true,
        nickname: true,
        phone: true,
        currentStatus: true,
        sourceChannel: true,
        createdAt: true,
        interestedPosition: { select: { id: true, title: true } },
        tags: {
          include: { tag: { select: { id: true, name: true, color: true } } },
        },
        assignments: {
          include: { assignedTo: { select: { id: true, name: true } } },
          take: 1,
          orderBy: { assignedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.jobPosition.findMany({
      where: { status: "OPEN" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <PipelineClient
      initialCandidates={candidates as any}
      jobs={jobs}
      userRole={session?.user?.role ?? "HR_STAFF"}
    />
  );
}
