import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET /api/shortlist/responses
// Returns candidateResponse for all INTERVIEW_SCHEDULED candidates
// Used by shortlist client to poll for updates every ~10s

export async function GET() {
  await auth();

  const interviews = await db.interview.findMany({
    where: {
      status: "SCHEDULED",
      candidate: { currentStatus: "INTERVIEW_SCHEDULED" },
    },
    select: {
      candidateId: true,
      candidateResponse: true,
      respondedAt: true,
    },
    orderBy: { createdAt: "desc" },
    distinct: ["candidateId"],
  });

  // Map candidateId → response
  const map: Record<string, string | null> = {};
  for (const i of interviews) {
    map[i.candidateId] = i.candidateResponse;
  }

  return NextResponse.json(map, {
    headers: { "Cache-Control": "no-store" },
  });
}
