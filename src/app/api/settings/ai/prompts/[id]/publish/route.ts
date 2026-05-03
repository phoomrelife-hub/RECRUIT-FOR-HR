import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Archive current published version
  await db.aiPromptVersion.updateMany({
    where: { status: "PUBLISHED" },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  const prompt = await db.aiPromptVersion.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "PUBLISH_AI_PROMPT", targetId: id, targetType: "AiPromptVersion" },
  });

  return NextResponse.json(prompt);
}
