import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { autoTagByPosition } from "@/lib/auto-tag";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CandidateStatus } from "@prisma/client";

const updateCandidateSchema = z.object({
  nickname: z.string().optional().nullable(),
  fullName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  age: z.number().int().positive().optional().nullable(),
  interestedPositionId: z.string().optional().nullable(),
  experienceStatus: z.enum(["EXPERIENCED", "FRESH_GRADUATE", "NO_EXPERIENCE"]).optional().nullable(),
  experienceDetail: z.string().optional().nullable(),
  expectedSalary: z.number().int().positive().optional().nullable(),
  availableStartDate: z.string().optional().nullable(),
  workPreference: z.enum(["ONSITE", "WFH", "HYBRID"]).optional().nullable(),
  hasComputer: z.boolean().optional().nullable(),
  hasInternet: z.boolean().optional().nullable(),
  resumeUrl: z.string().optional().nullable(),
  portfolioUrl: z.string().optional().nullable(),
  currentStatus: z.enum([
    "NEW_APPLICANT", "BOT_SCREENING", "WAITING_HR_REVIEW", "NEED_MORE_INFO",
    "QUALIFIED", "INTERVIEW_SCHEDULED", "INTERVIEWED", "PASSED", "HIRED", "REJECTED",
    "TALENT_POOL", "CLOSED",
  ]).optional(),
  statusReason: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    },
  });

  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "VIEW_CANDIDATE",
      targetId: id,
      targetType: "Candidate",
    },
  });

  return NextResponse.json(candidate);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { statusReason, currentStatus, ...rest } = parsed.data;

  const current = await db.candidate.findUnique({
    where: { id },
    select: { currentStatus: true, interestedPositionId: true },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const candidate = await db.candidate.update({
    where: { id },
    data: {
      ...rest,
      ...(currentStatus ? { currentStatus } : {}),
      availableStartDate: rest.availableStartDate ? new Date(rest.availableStartDate) : undefined,
    },
  });

  // auto-tag by position when interestedPositionId changes
  if (rest.interestedPositionId !== undefined && rest.interestedPositionId !== current.interestedPositionId) {
    await autoTagByPosition(id, rest.interestedPositionId, current.interestedPositionId);
  }

  if (currentStatus && currentStatus !== current.currentStatus) {
    await db.candidateStatusHistory.create({
      data: {
        candidateId: id,
        fromStatus: current.currentStatus as CandidateStatus,
        toStatus: currentStatus as CandidateStatus,
        changedById: session.user.id,
        reason: statusReason ?? null,
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CHANGE_CANDIDATE_STATUS",
        targetId: id,
        targetType: "Candidate",
        detail: { from: current.currentStatus, to: currentStatus },
      },
    });
  } else {
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EDIT_CANDIDATE",
        targetId: id,
        targetType: "Candidate",
      },
    });
  }

  return NextResponse.json(candidate);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await db.candidate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
