import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  jobPositionId: z.string().min(1),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forms = await db.screeningForm.findMany({
    include: {
      jobPosition: { select: { id: true, title: true } },
      questions: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(forms);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const form = await db.screeningForm.create({
    data: {
      title: parsed.data.title,
      jobPositionId: parsed.data.jobPositionId,
    },
    include: {
      jobPosition: { select: { id: true, title: true } },
      questions: true,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE_SCREENING_FORM",
      targetId: form.id,
      targetType: "ScreeningForm",
      detail: { title: form.title },
    },
  });

  return NextResponse.json(form, { status: 201 });
}
