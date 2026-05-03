import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const scoreSchema = z.object({
  experience: z.number().int().min(0).max(10),
  communication: z.number().int().min(0).max(10),
  availability: z.number().int().min(0).max(10),
  salaryFit: z.number().int().min(0).max(10),
  roleFit: z.number().int().min(0).max(10),
  attitude: z.number().int().min(0).max(10),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const score = await db.candidateScore.findUnique({ where: { candidateId: id } });
  return NextResponse.json(score);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = scoreSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const total =
    parsed.data.experience +
    parsed.data.communication +
    parsed.data.availability +
    parsed.data.salaryFit +
    parsed.data.roleFit +
    parsed.data.attitude;

  const score = await db.candidateScore.upsert({
    where: { candidateId: id },
    create: { candidateId: id, ...parsed.data, totalScore: total },
    update: { ...parsed.data, totalScore: total },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "SCORE_CANDIDATE",
      targetId: id,
      targetType: "Candidate",
      detail: { totalScore: total },
    },
  });

  return NextResponse.json(score);
}
