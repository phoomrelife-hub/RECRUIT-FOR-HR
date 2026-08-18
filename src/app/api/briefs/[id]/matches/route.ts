import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/briefs/[id]/matches?minStars=3&includeFiltered=false&limit=100
//
// The ranked list HR reads. Contact details ARE returned here — HR needs them
// to make contact. They are simply never sent to the model (see scrub.ts).

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  const minStars = Math.max(0, Math.min(5, Number(url.searchParams.get("minStars")) || 0));
  const includeFiltered = url.searchParams.get("includeFiltered") === "true";
  const limit = Math.max(1, Math.min(300, Number(url.searchParams.get("limit")) || 100));

  const rows = await db.candidateBriefScore.findMany({
    where: {
      briefId: id,
      stars: { gte: minStars },
      ...(includeFiltered ? {} : { filteredOut: false }),
    },
    orderBy: [{ stars: "desc" }, { overallScore: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      stars: true,
      overallScore: true,
      coveragePct: true,
      criteria: true,
      why: true,
      filteredOut: true,
      filterReason: true,
      notifiedAt: true,
      createdAt: true,
      candidate: {
        select: {
          id: true,
          fullName: true,
          nickname: true,
          phone: true,
          lineDisplayName: true,
          currentStatus: true,
          age: true,
          expectedSalary: true,
          workPreference: true,
          experienceText: true,
          notionPageId: true,
        },
      },
    },
  });

  // Counts come from a grouped query rather than the page of rows above, so the
  // filter chips show totals rather than "how many of the first 100".
  const grouped = await db.candidateBriefScore.groupBy({
    by: ["stars"],
    where: { briefId: id, filteredOut: false },
    _count: { _all: true },
  });
  const byStars = Object.fromEntries(grouped.map((g) => [g.stars, g._count._all]));
  const filteredCount = await db.candidateBriefScore.count({
    where: { briefId: id, filteredOut: true },
  });

  return NextResponse.json({ matches: rows, byStars, filteredCount });
}
