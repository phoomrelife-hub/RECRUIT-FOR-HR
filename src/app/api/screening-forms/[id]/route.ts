import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const form = await db.screeningForm.findUnique({
    where: { id },
    include: {
      jobPosition: { select: { id: true, title: true } },
      questions: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(form);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const form = await db.screeningForm.update({
    where: { id },
    data: parsed.data,
    include: {
      jobPosition: { select: { id: true, title: true } },
      questions: { orderBy: { sortOrder: "asc" } },
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_SCREENING_FORM",
      targetId: id,
      targetType: "ScreeningForm",
    },
  });

  return NextResponse.json(form);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await db.screeningForm.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE_SCREENING_FORM",
      targetId: id,
      targetType: "ScreeningForm",
    },
  });

  return NextResponse.json({ success: true });
}
