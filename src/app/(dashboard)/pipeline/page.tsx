import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PipelineClient } from "./pipeline-client";

export default async function PipelinePage() {
  const session = await auth();

  const jobs = await db.jobPosition.findMany({
    where: { status: "OPEN" },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <PipelineClient
      initialCandidates={[]}
      jobs={jobs}
      userRole={session?.user?.role ?? "HR_STAFF"}
    />
  );
}
