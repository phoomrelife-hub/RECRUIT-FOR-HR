import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InterviewType, CandidateStatus, AuditAction } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  candidateId: z.string(),
  jobPositionId: z.string().optional(),
  interviewDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  interviewType: z.nativeEnum(InterviewType),
  interviewerId: z.string().optional(),
  location: z.string().optional(),
  meetingLink: z.string().optional(),
  note: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const candidateId = searchParams.get("candidateId");

  const where = candidateId ? { candidateId } : {};

  const interviews = await db.interview.findMany({
    where,
    orderBy: { interviewDate: "desc" },
    include: {
      candidate: { select: { id: true, fullName: true, nickname: true, interestedPosition: { select: { title: true } } } },
      jobPosition: { select: { id: true, title: true } },
      interviewer: { select: { id: true, name: true } },
      feedback: true,
    },
  });

  return NextResponse.json(interviews);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;

  const interview = await db.interview.create({
    data: {
      candidateId: data.candidateId,
      jobPositionId: data.jobPositionId,
      interviewDate: new Date(data.interviewDate),
      startTime: data.startTime,
      endTime: data.endTime,
      interviewType: data.interviewType,
      interviewerId: data.interviewerId,
      location: data.location,
      meetingLink: data.meetingLink,
      note: data.note,
      createdById: session.user.id,
    },
    include: {
      interviewer: { select: { id: true, name: true } },
      feedback: true,
    },
  });

  // Auto-change candidate status to INTERVIEW_SCHEDULED
  const candidate = await db.candidate.findUnique({ where: { id: data.candidateId }, select: { currentStatus: true } });
  if (candidate && candidate.currentStatus !== CandidateStatus.INTERVIEW_SCHEDULED) {
    await db.candidate.update({
      where: { id: data.candidateId },
      data: { currentStatus: CandidateStatus.INTERVIEW_SCHEDULED },
    });
    await db.candidateStatusHistory.create({
      data: {
        candidateId: data.candidateId,
        fromStatus: candidate.currentStatus,
        toStatus: CandidateStatus.INTERVIEW_SCHEDULED,
        changedById: session.user.id,
        reason: "Interview scheduled",
      },
    });
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: AuditAction.CREATE_INTERVIEW,
      targetId: data.candidateId,
      targetType: "Candidate",
      detail: { interviewId: interview.id, type: data.interviewType },
    },
  });

  return NextResponse.json(interview, { status: 201 });
}
