import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InterviewResult, InterviewStatus, CandidateStatus, AuditAction } from "@prisma/client";
import { z } from "zod";

const feedbackSchema = z.object({
  communication: z.number().int().min(0).max(10),
  personality: z.number().int().min(0).max(10),
  experience: z.number().int().min(0).max(10),
  roleUnderstanding: z.number().int().min(0).max(10),
  availability: z.number().int().min(0).max(10),
  attitude: z.number().int().min(0).max(10),
  salaryExpectation: z.number().int().nullable().optional(),
  strengths: z.string().optional(),
  concerns: z.string().optional(),
  hrComment: z.string().optional(),
  finalResult: z.nativeEnum(InterviewResult).nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const feedback = await db.interviewFeedback.findUnique({
    where: { interviewId: id },
    include: { submittedBy: { select: { id: true, name: true } } },
  });

  if (!feedback) return NextResponse.json(null);
  return NextResponse.json(feedback);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;

  const feedback = await db.interviewFeedback.upsert({
    where: { interviewId: id },
    create: {
      interviewId: id,
      communication: data.communication,
      personality: data.personality,
      experience: data.experience,
      roleUnderstanding: data.roleUnderstanding,
      availability: data.availability,
      attitude: data.attitude,
      salaryExpectation: data.salaryExpectation ?? null,
      strengths: data.strengths,
      concerns: data.concerns,
      hrComment: data.hrComment,
      finalResult: data.finalResult ?? null,
      submittedById: session.user.id,
    },
    update: {
      communication: data.communication,
      personality: data.personality,
      experience: data.experience,
      roleUnderstanding: data.roleUnderstanding,
      availability: data.availability,
      attitude: data.attitude,
      salaryExpectation: data.salaryExpectation ?? null,
      strengths: data.strengths,
      concerns: data.concerns,
      hrComment: data.hrComment,
      finalResult: data.finalResult ?? null,
      submittedById: session.user.id,
    },
    include: { submittedBy: { select: { id: true, name: true } } },
  });

  // Mark interview as COMPLETED and auto-change candidate status to INTERVIEWED
  const interview = await db.interview.update({
    where: { id },
    data: { status: InterviewStatus.COMPLETED },
    select: { candidateId: true },
  });

  const candidate = await db.candidate.findUnique({
    where: { id: interview.candidateId },
    select: { currentStatus: true },
  });

  if (candidate && candidate.currentStatus !== CandidateStatus.INTERVIEWED) {
    await db.candidate.update({
      where: { id: interview.candidateId },
      data: { currentStatus: CandidateStatus.INTERVIEWED },
    });
    await db.candidateStatusHistory.create({
      data: {
        candidateId: interview.candidateId,
        fromStatus: candidate.currentStatus,
        toStatus: CandidateStatus.INTERVIEWED,
        changedById: session.user.id,
        reason: "Interview completed, feedback submitted",
      },
    });
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: AuditAction.SUBMIT_INTERVIEW_FEEDBACK,
      targetId: interview.candidateId,
      targetType: "Candidate",
      detail: { interviewId: id, result: data.finalResult },
    },
  });

  return NextResponse.json(feedback);
}
