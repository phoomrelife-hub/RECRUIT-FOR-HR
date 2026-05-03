import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listProviders, upsertProvider } from "@/lib/ai/ai-provider.service";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const providers = await listProviders();
  return NextResponse.json(providers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const provider = await upsertProvider(body);

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_AI_PROVIDER",
      targetId: provider.id,
      targetType: "AiProvider",
      detail: { name: provider.name },
    },
  });

  return NextResponse.json(provider);
}
