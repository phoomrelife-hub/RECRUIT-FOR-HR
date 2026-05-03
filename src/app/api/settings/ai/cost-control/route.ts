import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCostSummary, upsertCostLimit } from "@/lib/ai/ai-cost.service";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const summary = await getCostSummary();
  return NextResponse.json(summary);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const limit = await upsertCostLimit(body);

  const { db } = await import("@/lib/db");
  await db.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_AI_COST_LIMIT", targetId: limit.id, targetType: "AiCostLimit" },
  });

  return NextResponse.json(limit);
}
