import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getNextPromptVersion } from "@/lib/ai/ai-prompt-builder";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const original = await db.aiPromptVersion.findUnique({ where: { id } });
  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const version = await getNextPromptVersion();
  const restored = await db.aiPromptVersion.create({
    data: {
      version,
      title: `${original.title} (Restored)`,
      content: original.content,
      status: "DRAFT",
      createdById: session.user.id,
    },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "RESTORE_AI_PROMPT", targetId: restored.id, targetType: "AiPromptVersion" },
  });

  return NextResponse.json(restored);
}
