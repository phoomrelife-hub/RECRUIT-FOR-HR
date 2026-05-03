import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; tagId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, tagId } = await params;

  const [candidate, tag] = await Promise.all([
    db.candidate.findUnique({ where: { id } }),
    db.tag.findUnique({ where: { id: tagId } }),
  ]);
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  if (!tag) return NextResponse.json({ error: "Tag not found" }, { status: 404 });

  const existing = await db.candidateTag.findUnique({
    where: { candidateId_tagId: { candidateId: id, tagId } },
  });
  if (existing) return NextResponse.json({ error: "Tag already assigned" }, { status: 409 });

  await db.candidateTag.create({ data: { candidateId: id, tagId } });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "ADD_CANDIDATE_TAG",
      targetId: id,
      targetType: "Candidate",
      detail: { tagId, tagName: tag.name },
    },
  });

  return NextResponse.json({ success: true, tag }, { status: 201 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; tagId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, tagId } = await params;

  const existing = await db.candidateTag.findUnique({
    where: { candidateId_tagId: { candidateId: id, tagId } },
  });
  if (!existing) return NextResponse.json({ error: "Tag not assigned" }, { status: 404 });

  await db.candidateTag.delete({
    where: { candidateId_tagId: { candidateId: id, tagId } },
  });

  const tag = await db.tag.findUnique({ where: { id: tagId } });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "REMOVE_CANDIDATE_TAG",
      targetId: id,
      targetType: "Candidate",
      detail: { tagId, tagName: tag?.name },
    },
  });

  return NextResponse.json({ success: true });
}
