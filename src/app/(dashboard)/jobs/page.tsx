import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { JobsClient } from "./jobs-client";

export default async function JobsPage() {
  const session = await auth();

  const jobs = await db.jobPosition.findMany({
    include: { _count: { select: { candidates: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Job Positions</h1>
        <p className="mt-1 text-sm text-slate-500">จัดการตำแหน่งงานและรับสมัครผู้สมัคร</p>
      </div>
      <JobsClient
        initialJobs={jobs as any}
        canManage={session?.user?.role !== "HR_STAFF"}
        canDelete={session?.user?.role === "SUPER_ADMIN"}
      />
    </div>
  );
}
