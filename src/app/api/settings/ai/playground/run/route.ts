import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runPlayground } from "@/lib/ai/ai-playground.service";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const result = await runPlayground({
    systemPrompt: body.systemPrompt ?? "",
    messages: body.messages ?? [],
    providerId: body.providerId,
    model: body.model,
    createdById: session.user.id,
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "RUN_AI_PLAYGROUND", targetType: "AiPlayground" },
  });

  return NextResponse.json(result);
}
