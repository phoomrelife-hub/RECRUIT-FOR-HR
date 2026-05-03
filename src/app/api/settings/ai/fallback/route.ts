import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const setting = await db.aiFallbackSetting.findFirst();
  return NextResponse.json(setting ?? { enabled: true, maxRetries: 2, notifyHr: true, fallbackMessage: null });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const existing = await db.aiFallbackSetting.findFirst();
  const setting = existing
    ? await db.aiFallbackSetting.update({ where: { id: existing.id }, data: body })
    : await db.aiFallbackSetting.create({ data: body });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_AI_FALLBACK", targetId: setting.id, targetType: "AiFallbackSetting" },
  });

  return NextResponse.json(setting);
}
