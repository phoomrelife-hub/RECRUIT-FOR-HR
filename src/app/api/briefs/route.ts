import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { briefHash } from "@/lib/brief/hash";
import { parseBrief } from "@/lib/brief/parse";
import { AiNotConfiguredError } from "@/lib/brief/ai";
import type { Prisma } from "@prisma/client";

// GET  /api/briefs            — every open position with its brief (if any)
// POST /api/briefs            — write/replace the brief for one position
//                               body: { jobPositionId, rawBrief }

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const positions = await db.jobPosition.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      workType: true,
      hiringBrief: true,
      _count: { select: { candidates: true } },
    },
  });

  // Counting matches per brief in one grouped query rather than per row.
  const briefIds = positions.map((p) => p.hiringBrief?.id).filter((v): v is string => !!v);
  const grouped = briefIds.length
    ? await db.candidateBriefScore.groupBy({
        by: ["briefId"],
        where: { briefId: { in: briefIds }, filteredOut: false, stars: { gte: 4 } },
        _count: { _all: true },
      })
    : [];
  const strongByBrief = new Map(grouped.map((g) => [g.briefId, g._count._all]));

  return NextResponse.json({
    positions: positions.map((p) => ({
      id: p.id,
      title: p.title,
      workType: p.workType,
      candidateCount: p._count.candidates,
      brief: p.hiringBrief,
      strongMatches: p.hiringBrief ? (strongByBrief.get(p.hiringBrief.id) ?? 0) : 0,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const jobPositionId = typeof body.jobPositionId === "string" ? body.jobPositionId : "";
  const rawBrief = typeof body.rawBrief === "string" ? body.rawBrief.trim() : "";

  if (!jobPositionId) {
    return NextResponse.json({ error: "jobPositionId is required" }, { status: 400 });
  }
  if (rawBrief.length < 5) {
    return NextResponse.json({ error: "กรุณาเขียนบรีฟอย่างน้อย 5 ตัวอักษร" }, { status: 400 });
  }

  const position = await db.jobPosition.findUnique({
    where: { id: jobPositionId },
    select: { id: true, title: true },
  });
  if (!position) return NextResponse.json({ error: "ไม่พบตำแหน่งงาน" }, { status: 404 });

  let parsed;
  try {
    ({ parsed } = await parseBrief(rawBrief, position.title));
  } catch (e) {
    // A missing key is a setup problem, not a server fault — say so with a 400
    // so the UI can point HR at the settings page instead of showing a crash.
    if (e instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "อ่านบรีฟไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const hash = briefHash(parsed);
  const data = {
    rawBrief,
    ...parsed.filters,
    criteria: parsed.criteria as unknown as Prisma.InputJsonValue,
    briefHash: hash,
    isActive: true,
  };

  const brief = await db.hiringBrief.upsert({
    where: { jobPositionId },
    create: { jobPositionId, createdById: session.user.id, ...data },
    update: data,
  });

  return NextResponse.json({ brief });
}
