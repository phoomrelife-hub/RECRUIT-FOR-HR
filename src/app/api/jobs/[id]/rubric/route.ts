import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { draftRubric, normaliseWeights } from "@/lib/qualifier/rubric";
import { NextResponse } from "next/server";
import { z } from "zod";

const canEdit = (role?: string) => role === "SUPER_ADMIN" || role === "HR_MANAGER";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const config = await db.aiScoringConfig.findFirst({
    where: { jobPositionId: id },
    include: { categories: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(config);
}

/** POST = ask the AI for a draft. Always saved with isDraft: true — never scores anything. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canEdit(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const job = await db.jobPosition.findUnique({
    where: { id },
    select: { title: true, description: true, requiredExperience: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let criteria;
  try {
    criteria = await draftRubric(job);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ร่างเกณฑ์ไม่สำเร็จ" },
      { status: 502 },
    );
  }

  const existing = await db.aiScoringConfig.findFirst({ where: { jobPositionId: id } });
  if (existing) {
    // Delete + recreate must not straddle a partial failure — a dropped connection
    // between the two calls would leave the rubric with zero criteria.
    await db.$transaction(async (tx) => {
      await tx.aiScoringCategory.deleteMany({ where: { configId: existing.id } });
      await tx.aiScoringConfig.update({
        where: { id: existing.id },
        data: {
          isDraft: true, approvedAt: null, approvedById: null,
          categories: { create: criteria },
        },
      });
    });
  } else {
    await db.aiScoringConfig.create({
      data: {
        name: `เกณฑ์: ${job.title}`,
        jobPositionId: id,
        isDraft: true,
        categories: { create: criteria },
      },
    });
  }

  const saved = await db.aiScoringConfig.findFirst({
    where: { jobPositionId: id },
    include: { categories: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(saved);
}

const putSchema = z.object({
  criteria: z.array(z.object({
    name: z.string().min(1),
    weight: z.number().min(0).max(100),
    description: z.string(),
  })).min(1),
});

/** PUT = HR saves and approves. This is the only path that clears isDraft. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canEdit(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const criteria = normaliseWeights(
    parsed.data.criteria.map((c, i) => ({ ...c, sortOrder: i })),
  );

  const existing = await db.aiScoringConfig.findFirst({ where: { jobPositionId: id } });
  const configId = existing
    ? existing.id
    : (await db.aiScoringConfig.create({
        data: { name: "เกณฑ์เฉพาะตำแหน่ง", jobPositionId: id, isDraft: true },
      })).id;

  // Delete + recreate must not straddle a partial failure — a dropped connection
  // between the two calls would leave the rubric with zero criteria.
  await db.$transaction(async (tx) => {
    await tx.aiScoringCategory.deleteMany({ where: { configId } });
    await tx.aiScoringConfig.update({
      where: { id: configId },
      data: {
        isDraft: false,
        isActive: true,
        approvedById: session!.user!.id,
        approvedAt: new Date(),
        categories: { create: criteria },
      },
    });
  });

  const saved = await db.aiScoringConfig.findFirst({
    where: { id: configId },
    include: { categories: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(saved);
}
