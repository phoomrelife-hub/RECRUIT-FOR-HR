import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  question: z.string().min(1),
  fieldKey: z.string().min(1),
  sortOrder: z.number().int().default(0),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const question = await db.screeningQuestion.create({
    data: {
      screeningFormId: id,
      question: parsed.data.question,
      fieldKey: parsed.data.fieldKey,
      sortOrder: parsed.data.sortOrder,
    },
  });

  return NextResponse.json(question, { status: 201 });
}
