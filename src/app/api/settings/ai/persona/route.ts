import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const persona = await db.aiPersona.findFirst();
  return NextResponse.json(persona ?? { botName: "Daniel", tone: "professional", language: "thai_english" });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const existing = await db.aiPersona.findFirst();
  const persona = existing
    ? await db.aiPersona.update({ where: { id: existing.id }, data: body })
    : await db.aiPersona.create({ data: body });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_AI_PERSONA", targetId: persona.id, targetType: "AiPersona" },
  });

  return NextResponse.json(persona);
}
