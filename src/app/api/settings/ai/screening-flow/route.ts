import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const flows = await db.aiScreeningFlow.findMany({
    include: { questions: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(flows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { questions, ...flowData } = body;

  const flow = await db.aiScreeningFlow.create({
    data: {
      ...flowData,
      questions: questions
        ? { create: questions.map((q: { question: string; fieldKey: string; required?: boolean; sortOrder?: number }) => q) }
        : undefined,
    },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_AI_SCREENING_FLOW", targetId: flow.id, targetType: "AiScreeningFlow" },
  });

  return NextResponse.json(flow);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, questions, ...flowData } = body;

  await db.aiScreeningQuestion.deleteMany({ where: { flowId: id } });

  const flow = await db.aiScreeningFlow.update({
    where: { id },
    data: {
      ...flowData,
      questions: questions ? { create: questions } : undefined,
    },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_AI_SCREENING_FLOW", targetId: id, targetType: "AiScreeningFlow" },
  });

  return NextResponse.json(flow);
}
