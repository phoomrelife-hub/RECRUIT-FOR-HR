import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { briefHash } from "@/lib/brief/hash";
import { EMPTY_HARD_FILTERS } from "@/lib/brief/types";
import type { Prisma } from "@prisma/client";

// GET  /api/briefs  — every open position with its brief (if any)
// POST /api/briefs  — create an EMPTY brief for a position; body: { jobPositionId }
//
// Creating a brief no longer calls the AI. The numeric requirements are typed
// into real fields and saved by PATCH; only the free-text "อื่นๆที่ต้องการ" box
// needs a model, and that is its own explicit endpoint (/parse). Splitting them
// is what lets HR change maxAge from 40 to 45 for free.

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const positions = await db.jobPosition.findMany({
    where: { status: "OPEN" },
    select: {
      id: true,
      title: true,
      workType: true,
      hiringBrief: true,
      _count: { select: { candidates: true } },
    },
  });

  return NextResponse.json({ positions });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const jobPositionId = typeof body.jobPositionId === "string" ? body.jobPositionId : "";
  if (!jobPositionId) {
    return NextResponse.json({ error: "jobPositionId is required" }, { status: 400 });
  }

  const position = await db.jobPosition.findUnique({
    where: { id: jobPositionId },
    select: { id: true, workType: true },
  });
  if (!position) return NextResponse.json({ error: "ไม่พบตำแหน่งงาน" }, { status: 404 });

  const existing = await db.hiringBrief.findUnique({ where: { jobPositionId } });
  if (existing) return NextResponse.json({ brief: existing });

  // Seed the work preference from the position, but it is rendered as a visible
  // segmented control — so a stale job_positions row shows up as a wrong-looking
  // selection HR can fix, rather than as a hidden filter nobody knows is on.
  const filters = { ...EMPTY_HARD_FILTERS, workPreference: position.workType };

  const brief = await db.hiringBrief.create({
    data: {
      jobPositionId,
      createdById: session.user.id,
      rawBrief: "",
      ...filters,
      criteria: [] as unknown as Prisma.InputJsonValue,
      briefHash: briefHash({ filters, criteria: [] }),
    },
  });

  return NextResponse.json({ brief });
}
