import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const quickReplySchema = z.object({
  title: z.string().min(1).max(50).optional(),
  content: z.string().min(1).max(1000).optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role === "HR_STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = quickReplySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.title === undefined && parsed.data.content === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const existing = await db.quickReply.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let updated;
  try {
    updated = await db.quickReply.update({ where: { id }, data: parsed.data });
  } catch (error: unknown) {
    // P2025 = record not found (e.g., deleted in another browser tab between the check above and this update)
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_QUICK_REPLY",
      targetId: id,
      targetType: "QuickReply",
      detail: { title: updated.title },
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
  const existing = await db.quickReply.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Hard delete is safe: Message.content is copied at send time, so sent
  // messages hold no reference back to the template.
  try {
    await db.quickReply.delete({ where: { id } });
  } catch (error: unknown) {
    // P2025 = record not found (e.g., deleted in another browser tab between the check above and this delete)
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE_QUICK_REPLY",
      targetId: id,
      targetType: "QuickReply",
      detail: { title: existing.title },
    },
  });

  return NextResponse.json({ success: true });
}
