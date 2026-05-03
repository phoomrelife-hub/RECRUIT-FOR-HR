import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobPositionId = searchParams.get("jobPositionId");

  const candidates = await db.candidate.findMany({
    where: jobPositionId ? { interestedPositionId: jobPositionId } : undefined,
    select: {
      id: true,
      fullName: true,
      nickname: true,
      phone: true,
      currentStatus: true,
      sourceChannel: true,
      createdAt: true,
      interestedPosition: { select: { id: true, title: true } },
      tags: {
        include: { tag: { select: { id: true, name: true, color: true } } },
      },
      assignments: {
        include: { assignedTo: { select: { id: true, name: true } } },
        take: 1,
        orderBy: { assignedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(candidates);
}
