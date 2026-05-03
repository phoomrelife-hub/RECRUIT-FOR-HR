import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const guardrails = await db.aiGuardrail.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json(guardrails);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const guardrail = await db.aiGuardrail.create({ data: body });
  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_AI_GUARDRAIL", targetId: guardrail.id, targetType: "AiGuardrail" },
  });
  return NextResponse.json(guardrail);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...data } = body;
  const guardrail = await db.aiGuardrail.update({ where: { id }, data });
  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_AI_GUARDRAIL", targetId: id, targetType: "AiGuardrail" },
  });
  return NextResponse.json(guardrail);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  await db.aiGuardrail.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
