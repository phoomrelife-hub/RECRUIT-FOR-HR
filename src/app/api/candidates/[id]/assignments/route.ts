import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const assignSchema = z.object({ assignedToId: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { assignedToId } = parsed.data;

  const [candidate, assignee] = await Promise.all([
    db.candidate.findUnique({ where: { id } }),
    db.user.findUnique({ where: { id: assignedToId } }),
  ]);
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  if (!assignee) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Remove existing assignment before creating new one (1 assignee at a time)
  await db.candidateAssignment.deleteMany({ where: { candidateId: id } });

  const assignment = await db.candidateAssignment.create({
    data: {
      candidateId: id,
      assignedToId,
      assignedById: session.user.id,
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "ASSIGN_CANDIDATE",
      targetId: id,
      targetType: "Candidate",
      detail: { assignedToId, assignedToName: assignee.name },
    },
  });

  return NextResponse.json(assignment, { status: 201 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await db.candidateAssignment.deleteMany({ where: { candidateId: id } });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UNASSIGN_CANDIDATE",
      targetId: id,
      targetType: "Candidate",
    },
  });

  return NextResponse.json({ success: true });
}
