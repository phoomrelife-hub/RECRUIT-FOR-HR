import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { upsertProvider, testProviderConnection } from "@/lib/ai/ai-provider.service";
import { db } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const provider = await upsertProvider({ ...body, id });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_AI_PROVIDER",
      targetId: id,
      targetType: "AiProvider",
    },
  });

  return NextResponse.json(provider);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await db.aiProvider.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await testProviderConnection(id);
  return NextResponse.json(result);
}
