import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { EditCandidateClient } from "./edit-candidate-client";

export default async function EditCandidatePage({ params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id } = await params;

  const [candidate, jobs] = await Promise.all([
    db.candidate.findUnique({ where: { id } }),
    db.jobPosition.findMany({
      where: { status: "OPEN" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  if (!candidate) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit Candidate</h1>
        <p className="mt-1 text-sm text-slate-500">
          แก้ไขข้อมูล {candidate.fullName ?? candidate.nickname ?? "ผู้สมัคร"}
        </p>
      </div>
      <EditCandidateClient candidate={candidate as any} jobs={jobs} />
    </div>
  );
}
