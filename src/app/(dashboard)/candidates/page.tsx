import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCachedOpenJobs } from "@/lib/cached-queries";
import { CandidatesClient } from "./candidates-client";

export default async function CandidatesPage() {
  const session = await auth();

  const [candidates, total, jobs] = await Promise.all([
    db.candidate.findMany({
      select: {
        id: true,
        fullName: true,
        nickname: true,
        phone: true,
        email: true,
        age: true,
        sourceChannel: true,
        currentStatus: true,
        experienceStatus: true,
        expectedSalary: true,
        createdAt: true,
        interestedPosition: { select: { id: true, title: true } },
        lineProfilePicUrl: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.candidate.count(),
    getCachedOpenJobs(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Candidates</h1>
        <p className="mt-1 text-sm text-slate-500">ฐานข้อมูลผู้สมัครทั้งหมด</p>
      </div>
      <CandidatesClient
        initialCandidates={candidates as any}
        initialTotal={total}
        jobs={jobs}
        canDelete={session?.user?.role === "SUPER_ADMIN"}
      />
    </div>
  );
}
