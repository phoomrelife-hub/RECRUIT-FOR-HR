import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const tagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role === "HR_STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = tagSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tag = await db.tag.findUnique({ where: { id } });
  if (!tag) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.name && parsed.data.name !== tag.name) {
    const dup = await db.tag.findFirst({ where: { name: parsed.data.name } });
    if (dup) return NextResponse.json({ error: "Tag name already exists" }, { status: 409 });
  }

  const updated = await db.tag.update({ where: { id }, data: parsed.data });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_TAG",
      targetId: id,
      targetType: "Tag",
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role === "HR_STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const tag = await db.tag.findUnique({ where: { id } });
  if (!tag) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.tag.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE_TAG",
      targetId: id,
      targetType: "Tag",
      detail: { name: tag.name },
    },
  });

  return NextResponse.json({ success: true });
}
