import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, noteId } = await params;

  const note = await db.candidateNote.findUnique({ where: { id: noteId } });
  if (!note || note.candidateId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the creator or SUPER_ADMIN can delete
  if (note.createdById !== session.user.id && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.candidateNote.delete({ where: { id: noteId } });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE_CANDIDATE_NOTE",
      targetId: id,
      targetType: "Candidate",
      detail: { noteId },
    },
  });

  return NextResponse.json({ success: true });
}
