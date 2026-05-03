import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rules = await db.aiHandoffRule.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rule = await db.aiHandoffRule.create({ data: body });
  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_AI_HANDOFF_RULE", targetId: rule.id, targetType: "AiHandoffRule" },
  });
  return NextResponse.json(rule);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...data } = body;
  const rule = await db.aiHandoffRule.update({ where: { id }, data });
  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_AI_HANDOFF_RULE", targetId: id, targetType: "AiHandoffRule" },
  });
  return NextResponse.json(rule);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  await db.aiHandoffRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
