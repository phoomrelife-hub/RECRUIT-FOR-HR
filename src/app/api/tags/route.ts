import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const tagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tags = await db.tag.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(tags);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role === "HR_STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = tagSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await db.tag.findFirst({ where: { name: parsed.data.name } });
  if (existing) return NextResponse.json({ error: "Tag name already exists" }, { status: 409 });

  const tag = await db.tag.create({ data: parsed.data });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE_TAG",
      targetId: tag.id,
      targetType: "Tag",
      detail: { name: tag.name },
    },
  });

  return NextResponse.json(tag, { status: 201 });
}
