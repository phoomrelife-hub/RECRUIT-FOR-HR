import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = await db.aiScoringConfig.findFirst({
    where: { isActive: true },
    include: { categories: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { categories, ...configData } = body;

  let config = await db.aiScoringConfig.findFirst({ where: { isActive: true } });

  if (config) {
    await db.aiScoringCategory.deleteMany({ where: { configId: config.id } });
    config = await db.aiScoringConfig.update({
      where: { id: config.id },
      data: {
        ...configData,
        categories: categories ? { create: categories } : undefined,
      },
      include: { categories: { orderBy: { sortOrder: "asc" } } },
    } as Parameters<typeof db.aiScoringConfig.update>[0]);
  } else {
    config = await db.aiScoringConfig.create({
      data: {
        ...configData,
        categories: categories ? { create: categories } : undefined,
      },
      include: { categories: { orderBy: { sortOrder: "asc" } } },
    });
  }

  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_AI_SCORING", targetId: config.id, targetType: "AiScoringConfig" },
  });

  return NextResponse.json(config);
}
