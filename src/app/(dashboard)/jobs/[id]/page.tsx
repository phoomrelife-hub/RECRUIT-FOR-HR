import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MapPin, Clock, Users, Briefcase, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { CandidateStatus, WorkType, JobStatus } from "@prisma/client";
import { RubricEditor } from "./rubric-editor";

const statusBadge: Record<JobStatus, string> = {
  OPEN: "bg-green-100 text-green-700",
  CLOSED: "bg-slate-100 text-slate-500",
  DRAFT: "bg-yellow-100 text-yellow-700",
};

const workTypeLabel: Record<WorkType, string> = {
  ONSITE: "Onsite",
  WFH: "WFH",
  HYBRID: "Hybrid",
};

const candidateStatusLabel: Record<CandidateStatus, string> = {
  NEW_APPLICANT: "New",
  BOT_SCREENING: "Screening",
  WAITING_HR_REVIEW: "Waiting Review",
  NEED_MORE_INFO: "Need Info",
  QUALIFIED: "Qualified",
  INTERVIEW_SCHEDULED: "Interview Set",
  INTERVIEWED: "Interviewed",
  PASSED: "Passed",
  HIRED: "Hired",
  REJECTED: "Rejected",
  TALENT_POOL: "Talent Pool",
  CLOSED: "Closed",
};

const candidateStatusColor: Record<CandidateStatus, string> = {
  NEW_APPLICANT: "bg-slate-100 text-slate-600",
  BOT_SCREENING: "bg-blue-100 text-blue-600",
  WAITING_HR_REVIEW: "bg-yellow-100 text-yellow-700",
  NEED_MORE_INFO: "bg-orange-100 text-orange-700",
  QUALIFIED: "bg-teal-100 text-teal-700",
  INTERVIEW_SCHEDULED: "bg-purple-100 text-purple-700",
  INTERVIEWED: "bg-indigo-100 text-indigo-700",
  PASSED: "bg-green-100 text-green-700",
  HIRED: "bg-teal-100 text-teal-700",
  REJECTED: "bg-red-100 text-red-600",
  TALENT_POOL: "bg-cyan-100 text-cyan-700",
  CLOSED: "bg-slate-100 text-slate-400",
};

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id } = await params;

  const job = await db.jobPosition.findUnique({
    where: { id },
    include: {
      candidates: {
        select: {
          id: true,
          fullName: true,
          nickname: true,
          currentStatus: true,
          sourceChannel: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { candidates: true } },
    },
  });

  if (!job) notFound();

  const statusCounts = job.candidates.reduce(
    (acc, c) => {
      acc[c.currentStatus] = (acc[c.currentStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<CandidateStatus, number>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/jobs">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
            <Badge className={statusBadge[job.status]}>{job.status}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {job.department} · {workTypeLabel[job.workType]}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Job Info */}
        <div className="col-span-1 space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">รายละเอียดตำแหน่ง</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {job.location && (
                <div className="flex items-start gap-2 text-slate-600">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                  <span>{job.location}</span>
                </div>
              )}
              {job.workingTime && (
                <div className="flex items-start gap-2 text-slate-600">
                  <Clock className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                  <span>{job.workingTime}</span>
                </div>
              )}
              <div className="flex items-start gap-2 text-slate-600">
                <Users className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                <span>รับ {job.headcount} คน</span>
              </div>
              {(job.salaryMin || job.salaryMax) && (
                <div className="flex items-start gap-2 text-slate-600">
                  <DollarSign className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                  <span>
                    {job.salaryMin?.toLocaleString()} – {job.salaryMax?.toLocaleString()} บาท
                  </span>
                </div>
              )}
              {job.requiredExperience && (
                <div className="flex items-start gap-2 text-slate-600">
                  <Briefcase className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                  <span>{job.requiredExperience}</span>
                </div>
              )}
              {job.description && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 whitespace-pre-line">{job.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">สถานะผู้สมัคร</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(Object.entries(statusCounts) as [CandidateStatus, number][]).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <Badge className={`${candidateStatusColor[status]} text-xs`}>
                    {candidateStatusLabel[status]}
                  </Badge>
                  <span className="text-sm font-medium text-slate-700">{count}</span>
                </div>
              ))}
              {job._count.candidates === 0 && (
                <p className="text-xs text-slate-400">ยังไม่มีผู้สมัคร</p>
              )}
            </CardContent>
          </Card>

          <RubricEditor jobId={job.id} />
        </div>

        {/* Candidates */}
        <div className="col-span-2">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">
                ผู้สมัคร ({job._count.candidates})
              </CardTitle>
              <Link href={`/candidates/new?jobId=${job.id}`}>
                <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                  + เพิ่มผู้สมัคร
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {job.candidates.map((c) => (
                  <Link
                    key={c.id}
                    href={`/candidates/${c.id}`}
                    className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {c.fullName ?? c.nickname ?? "ไม่ระบุชื่อ"}
                      </p>
                      <p className="text-xs text-slate-400">{c.sourceChannel}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`${candidateStatusColor[c.currentStatus]} text-xs`}>
                        {candidateStatusLabel[c.currentStatus]}
                      </Badge>
                      <p className="text-xs text-slate-400">
                        {format(new Date(c.createdAt), "d MMM yyyy")}
                      </p>
                    </div>
                  </Link>
                ))}
                {job.candidates.length === 0 && (
                  <p className="py-10 text-center text-sm text-slate-400">ยังไม่มีผู้สมัครสำหรับตำแหน่งนี้</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
