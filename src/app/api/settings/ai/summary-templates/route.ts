import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const templates = await db.aiSummaryTemplate.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (body.isDefault) {
    await db.aiSummaryTemplate.updateMany({ data: { isDefault: false } });
  }
  const template = await db.aiSummaryTemplate.create({ data: body });
  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_AI_SUMMARY_TEMPLATE", targetId: template.id, targetType: "AiSummaryTemplate" },
  });
  return NextResponse.json(template);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...data } = body;
  if (data.isDefault) {
    await db.aiSummaryTemplate.updateMany({ data: { isDefault: false } });
  }
  const template = await db.aiSummaryTemplate.update({ where: { id }, data });
  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_AI_SUMMARY_TEMPLATE", targetId: id, targetType: "AiSummaryTemplate" },
  });
  return NextResponse.json(template);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  await db.aiSummaryTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
