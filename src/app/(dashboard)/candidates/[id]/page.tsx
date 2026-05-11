import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, DollarSign, Briefcase, ExternalLink, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { CandidateStatus, SourceChannel, ExperienceStatus } from "@prisma/client";
import { CandidateProfileClient } from "./candidate-profile-client";
import { QualifySection } from "./qualify-section";
import { NotionDataCard } from "./notion-data-card";

const statusColor: Record<CandidateStatus, string> = {
  NEW_APPLICANT: "bg-slate-100 text-slate-600",
  BOT_SCREENING: "bg-blue-100 text-blue-600",
  WAITING_HR_REVIEW: "bg-yellow-100 text-yellow-700",
  NEED_MORE_INFO: "bg-orange-100 text-orange-700",
  QUALIFIED: "bg-teal-100 text-teal-700",
  INTERVIEW_SCHEDULED: "bg-purple-100 text-purple-700",
  INTERVIEWED: "bg-indigo-100 text-indigo-700",
  PASSED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-600",
  TALENT_POOL: "bg-cyan-100 text-cyan-700",
  CLOSED: "bg-slate-100 text-slate-400",
};

const statusLabel: Record<CandidateStatus, string> = {
  NEW_APPLICANT: "ผู้สมัครใหม่",
  BOT_SCREENING: "บอทคัดกรอง",
  WAITING_HR_REVIEW: "รอ HR พิจารณา",
  NEED_MORE_INFO: "ขอข้อมูลเพิ่ม",
  QUALIFIED: "ผ่านเกณฑ์",
  INTERVIEW_SCHEDULED: "นัดสัมภาษณ์",
  INTERVIEWED: "สัมภาษณ์แล้ว",
  PASSED: "ผ่านการคัดเลือก",
  REJECTED: "ไม่ผ่าน",
  TALENT_POOL: "Talent Pool",
  CLOSED: "ปิด",
};

const sourceLabel: Record<SourceChannel, string> = {
  LINE: "LINE",
  FACEBOOK: "Facebook",
  WEBSITE: "Website",
  MANUAL: "Manual",
  OTHER: "Other",
};

const expLabel: Record<ExperienceStatus, string> = {
  EXPERIENCED: "มีประสบการณ์",
  FRESH_GRADUATE: "จบใหม่",
  NO_EXPERIENCE: "ไม่มีประสบการณ์",
};

export default async function CandidateProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const candidate = await db.candidate.findUnique({
    where: { id },
    include: {
      interestedPosition: { select: { id: true, title: true, status: true } },
      owner: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
      notes: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      statusHistory: { orderBy: { createdAt: "desc" } },
      assignments: { include: { assignedTo: { select: { id: true, name: true } } } },
      screeningAnswers: { include: { screeningQuestion: true } },
      candidateScore: true,
      aiSummary: true,
      interviews: {
        orderBy: { interviewDate: "asc" },
        include: {
          interviewer: { select: { id: true, name: true } },
          feedback: { include: { submittedBy: { select: { id: true, name: true } } } },
        },
      },
      hiringDecision: { include: { decidedBy: { select: { id: true, name: true } } } },
    },
  });

  if (!candidate) notFound();

  const [jobs, allTags, hrUsers] = await Promise.all([
    db.jobPosition.findMany({
      where: { status: "OPEN" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    db.tag.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const screeningForm = candidate.interestedPositionId
    ? await db.screeningForm.findFirst({
        where: { jobPositionId: candidate.interestedPositionId, isActive: true },
        include: { questions: { orderBy: { sortOrder: "asc" } } },
      })
    : null;

  const displayName = candidate.fullName ?? candidate.nickname ?? "ไม่ระบุชื่อ";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/candidates">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
            {candidate.nickname && candidate.fullName && (
              <span className="text-slate-400 text-sm">({candidate.nickname})</span>
            )}
            <Badge className={statusColor[candidate.currentStatus]}>
              {statusLabel[candidate.currentStatus]}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {sourceLabel[candidate.sourceChannel]}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            เพิ่มเมื่อ {format(new Date(candidate.createdAt), "d MMM yyyy HH:mm")}
            {candidate.owner && ` · โดย ${candidate.owner.name}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/candidates/${id}/edit`}>
            <Button variant="outline" size="sm">แก้ไข</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Profile Info */}
        <div className="col-span-1 space-y-4">
          {/* LINE Profile Card */}
          {candidate.lineUserId && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  {candidate.lineProfilePicUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={candidate.lineProfilePicUrl}
                      alt={candidate.lineDisplayName ?? "LINE"}
                      className="w-12 h-12 rounded-full object-cover border-2 border-green-300"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center border-2 border-green-300">
                      <MessageCircle className="h-6 w-6 text-green-600" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-green-700 mb-0.5">LINE Profile</p>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {candidate.lineDisplayName ?? "ไม่ระบุชื่อ"}
                    </p>
                    <p className="text-[10px] text-green-600 font-mono truncate mt-0.5">
                      {candidate.lineUserId}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Qualify Section */}
          <QualifySection
            candidateId={candidate.id}
            currentStatus={candidate.currentStatus}
            lineUserId={candidate.lineUserId ?? null}
            hasNotionPage={!!candidate.notionPageId}
          />

          {/* Notion Data Card — show if linked */}
          {candidate.notionPageId && (
            <NotionDataCard
              candidateId={candidate.id}
              positionTitle={candidate.interestedPosition?.title ?? null}
            />
          )}

          {/* Contact */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">ข้อมูลติดต่อ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {candidate.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{candidate.phone}</span>
                </div>
              )}
              {candidate.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{candidate.email}</span>
                </div>
              )}
              {candidate.age && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-slate-400 text-xs">อายุ</span>
                  <span>{candidate.age} ปี</span>
                </div>
              )}
              {!candidate.phone && !candidate.email && !candidate.age && (
                <p className="text-xs text-slate-400">ไม่มีข้อมูลติดต่อ</p>
              )}
            </CardContent>
          </Card>

          {/* Job Info */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">ข้อมูลการสมัคร</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {candidate.interestedPosition && (
                <div className="flex items-start gap-2 text-slate-600">
                  <Briefcase className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <Link
                    href={`/jobs/${candidate.interestedPosition.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {candidate.interestedPosition.title}
                  </Link>
                </div>
              )}
              {candidate.experienceStatus && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-slate-400 text-xs">ประสบการณ์</span>
                  <span>{expLabel[candidate.experienceStatus]}</span>
                </div>
              )}
              {candidate.expectedSalary && (
                <div className="flex items-center gap-2 text-slate-600">
                  <DollarSign className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{candidate.expectedSalary.toLocaleString()} บาท</span>
                </div>
              )}
              {candidate.workPreference && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{candidate.workPreference}</span>
                </div>
              )}
              {candidate.availableStartDate && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>พร้อมเริ่ม {format(new Date(candidate.availableStartDate), "d MMM yyyy")}</span>
                </div>
              )}
              {candidate.experienceDetail && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500 whitespace-pre-line">{candidate.experienceDetail}</p>
                </div>
              )}
              {(candidate.resumeUrl || candidate.portfolioUrl) && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  {candidate.resumeUrl && (
                    <a
                      href={candidate.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Resume
                    </a>
                  )}
                  {candidate.portfolioUrl && (
                    <a
                      href={candidate.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Portfolio
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Right: Interactive Sections */}
        <div className="col-span-2">
          <CandidateProfileClient
            candidate={candidate as any}
            jobs={jobs}
            allTags={allTags}
            hrUsers={hrUsers}
            currentUserId={session?.user?.id ?? ""}
            currentUserRole={session?.user?.role ?? "HR_STAFF"}
            screeningForm={screeningForm as any}
          />
        </div>
      </div>
    </div>
  );
}
