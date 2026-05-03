import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Video, Phone, Building2, User } from "lucide-react";
import { format } from "date-fns";
import { InterviewType, InterviewStatus } from "@prisma/client";

const typeIcon: Record<InterviewType, React.ReactNode> = {
  PHONE: <Phone className="h-3.5 w-3.5" />,
  ONLINE: <Video className="h-3.5 w-3.5" />,
  ONSITE: <Building2 className="h-3.5 w-3.5" />,
};

const typeLabel: Record<InterviewType, string> = {
  PHONE: "Phone",
  ONLINE: "Online",
  ONSITE: "On-site",
};

const statusColor: Record<InterviewStatus, string> = {
  SCHEDULED: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  NO_SHOW: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default async function InterviewsPage() {
  await auth();

  const interviews = await db.interview.findMany({
    orderBy: [{ interviewDate: "asc" }, { startTime: "asc" }],
    include: {
      candidate: {
        select: { id: true, fullName: true, nickname: true, interestedPosition: { select: { title: true } } },
      },
      jobPosition: { select: { id: true, title: true } },
      interviewer: { select: { id: true, name: true } },
      feedback: { select: { id: true, finalResult: true } },
    },
  });

  const upcoming = interviews.filter((iv) => iv.status === InterviewStatus.SCHEDULED);
  const past = interviews.filter((iv) => iv.status !== InterviewStatus.SCHEDULED);

  function renderList(list: typeof interviews) {
    if (list.length === 0) return <p className="py-6 text-center text-sm text-slate-400">ไม่มีรายการ</p>;
    return (
      <div className="divide-y divide-slate-100">
        {list.map((iv) => {
          const displayName = iv.candidate.fullName ?? iv.candidate.nickname ?? "ไม่ระบุชื่อ";
          const position = iv.jobPosition?.title ?? iv.candidate.interestedPosition?.title ?? "—";
          return (
            <div key={iv.id} className="flex items-center gap-4 py-3 px-4 hover:bg-slate-50 transition-colors">
              {/* Type icon */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                {typeIcon[iv.interviewType]}
              </div>

              {/* Date/Time */}
              <div className="w-32 shrink-0">
                <p className="text-sm font-semibold text-slate-800">
                  {format(new Date(iv.interviewDate), "d MMM yyyy")}
                </p>
                <p className="text-xs text-slate-400">{iv.startTime} – {iv.endTime}</p>
              </div>

              {/* Candidate + Position */}
              <div className="flex-1 min-w-0">
                <Link href={`/candidates/${iv.candidate.id}`} className="text-sm font-medium text-blue-600 hover:underline truncate block">
                  {displayName}
                </Link>
                <p className="text-xs text-slate-500 truncate">{position}</p>
              </div>

              {/* Interviewer */}
              <div className="w-32 shrink-0 hidden md:flex items-center gap-1.5 text-xs text-slate-500">
                <User className="h-3 w-3 text-slate-300" />
                <span className="truncate">{iv.interviewer?.name ?? "—"}</span>
              </div>

              {/* Type badge */}
              <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500 w-16 shrink-0">
                {typeLabel[iv.interviewType]}
              </span>

              {/* Status */}
              <Badge className={`text-xs px-2 py-0.5 shrink-0 ${statusColor[iv.status]}`}>
                {iv.status}
              </Badge>

              {/* Feedback indicator */}
              <div className="w-20 shrink-0 text-right">
                {iv.feedback ? (
                  <span className="text-xs text-green-600 font-medium">มี Feedback</span>
                ) : iv.status === InterviewStatus.COMPLETED ? (
                  <Link href={`/candidates/${iv.candidate.id}`} className="text-xs text-amber-600 hover:underline">
                    + Feedback
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Interviews</h1>
        <p className="mt-1 text-sm text-slate-500">รายการนัดสัมภาษณ์ทั้งหมด</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "ทั้งหมด", value: interviews.length, color: "text-slate-700" },
          { label: "Scheduled", value: upcoming.length, color: "text-purple-600" },
          { label: "Completed", value: past.filter((iv) => iv.status === InterviewStatus.COMPLETED).length, color: "text-green-600" },
          { label: "รอ Feedback", value: past.filter((iv) => iv.status === InterviewStatus.COMPLETED && !iv.feedback).length, color: "text-amber-600" },
        ].map((s) => (
          <Card key={s.label} className="border-slate-200">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-purple-500" />
          Upcoming ({upcoming.length})
        </h2>
        <Card className="border-slate-200 overflow-hidden">
          {renderList(upcoming)}
        </Card>
      </div>

      {/* Past */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          ที่ผ่านมา ({past.length})
        </h2>
        <Card className="border-slate-200 overflow-hidden">
          {renderList(past)}
        </Card>
      </div>
    </div>
  );
}
