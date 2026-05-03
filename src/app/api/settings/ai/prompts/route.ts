import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getNextPromptVersion } from "@/lib/ai/ai-prompt-builder";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const prompts = await db.aiPromptVersion.findMany({ orderBy: { version: "desc" } });
  return NextResponse.json(prompts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const version = await getNextPromptVersion();
  const prompt = await db.aiPromptVersion.create({
    data: {
      version,
      title: body.title ?? `Version ${version}`,
      content: body.content,
      status: "DRAFT",
      createdById: session.user.id,
    },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_AI_PROMPT", targetId: prompt.id, targetType: "AiPromptVersion" },
  });

  return NextResponse.json(prompt);
}
