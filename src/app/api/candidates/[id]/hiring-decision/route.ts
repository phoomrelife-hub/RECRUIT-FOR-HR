import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { HiringResult, CandidateStatus, AuditAction } from "@prisma/client";
import { z } from "zod";

const hiringResultToStatus: Record<HiringResult, CandidateStatus> = {
  PASSED: CandidateStatus.PASSED,
  REJECTED: CandidateStatus.REJECTED,
  TALENT_POOL: CandidateStatus.TALENT_POOL,
  HIRED: CandidateStatus.PASSED,
  CLOSED: CandidateStatus.CLOSED,
};

const decisionSchema = z.object({
  result: z.nativeEnum(HiringResult),
  reason: z.string().optional(),
  note: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const decision = await db.hiringDecision.findUnique({
    where: { candidateId: id },
    include: { decidedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(decision);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only HR_MANAGER and SUPER_ADMIN can make hiring decisions
  if (session.user.role === "HR_STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;

  const decision = await db.hiringDecision.upsert({
    where: { candidateId: id },
    create: {
      candidateId: id,
      result: data.result,
      reason: data.reason,
      note: data.note,
      decidedById: session.user.id,
    },
    update: {
      result: data.result,
      reason: data.reason,
      note: data.note,
      decidedById: session.user.id,
    },
    include: { decidedBy: { select: { id: true, name: true } } },
  });

  // Change candidate status based on hiring result
  const newStatus = hiringResultToStatus[data.result];
  const candidate = await db.candidate.findUnique({ where: { id }, select: { currentStatus: true } });

  if (candidate && candidate.currentStatus !== newStatus) {
    await db.candidate.update({ where: { id }, data: { currentStatus: newStatus } });
    await db.candidateStatusHistory.create({
      data: {
        candidateId: id,
        fromStatus: candidate.currentStatus,
        toStatus: newStatus,
        changedById: session.user.id,
        reason: `Hiring decision: ${data.result}${data.reason ? ` — ${data.reason}` : ""}`,
      },
    });
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: AuditAction.MAKE_HIRING_DECISION,
      targetId: id,
      targetType: "Candidate",
      detail: { result: data.result, reason: data.reason },
    },
  });

  return NextResponse.json(decision);
}
