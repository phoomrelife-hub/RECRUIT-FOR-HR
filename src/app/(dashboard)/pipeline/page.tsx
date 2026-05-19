import { auth } from "@/lib/auth";
import { getCachedOpenJobs } from "@/lib/cached-queries";
import { PipelineClient } from "./pipeline-client";

export default async function PipelinePage() {
  const session = await auth();

  const jobs = await getCachedOpenJobs();

  return (
    <PipelineClient
      initialCandidates={[]}
      jobs={jobs}
      userRole={session?.user?.role ?? "HR_STAFF"}
    />
  );
}
