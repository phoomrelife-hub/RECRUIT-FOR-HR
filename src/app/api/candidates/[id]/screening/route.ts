import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const candidate = await db.candidate.findUnique({
    where: { id },
    select: {
      interestedPositionId: true,
      screeningAnswers: {
        include: { screeningQuestion: true },
      },
    },
  });

  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!candidate.interestedPositionId) {
    return NextResponse.json({ form: null, answers: [] });
  }

  const form = await db.screeningForm.findFirst({
    where: { jobPositionId: candidate.interestedPositionId, isActive: true },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ form, answers: candidate.screeningAnswers });
}

const answersSchema = z.object({
  answers: z.array(
    z.object({
      screeningQuestionId: z.string(),
      answer: z.string(),
    })
  ),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = answersSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const exists = await db.candidate.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const questionIds = parsed.data.answers.map((a) => a.screeningQuestionId);

  await db.$transaction([
    db.screeningAnswer.deleteMany({
      where: { candidateId: id, screeningQuestionId: { in: questionIds } },
    }),
    db.screeningAnswer.createMany({
      data: parsed.data.answers
        .filter((a) => a.answer.trim())
        .map((a) => ({
          candidateId: id,
          screeningQuestionId: a.screeningQuestionId,
          answer: a.answer,
        })),
    }),
  ]);

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "SUBMIT_SCREENING_ANSWERS",
      targetId: id,
      targetType: "Candidate",
    },
  });

  const updated = await db.screeningAnswer.findMany({
    where: { candidateId: id },
    include: { screeningQuestion: true },
  });

  return NextResponse.json(updated);
}
