import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  question: z.string().min(1).optional(),
  fieldKey: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; qId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { qId } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const question = await db.screeningQuestion.update({
    where: { id: qId },
    data: parsed.data,
  });

  return NextResponse.json(question);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; qId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { qId } = await params;
  await db.screeningQuestion.delete({ where: { id: qId } });
  return NextResponse.json({ success: true });
}
