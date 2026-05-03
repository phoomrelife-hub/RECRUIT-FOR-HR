import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NewCandidateClient } from "./new-candidate-client";

export default async function NewCandidatePage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  await auth();
  const { jobId } = await searchParams;

  const jobs = await db.jobPosition.findMany({
    where: { status: "OPEN" },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Add Candidate</h1>
        <p className="mt-1 text-sm text-slate-500">เพิ่มผู้สมัครงานเข้าสู่ระบบ</p>
      </div>
      <NewCandidateClient jobs={jobs} defaultJobId={jobId} />
    </div>
  );
}
