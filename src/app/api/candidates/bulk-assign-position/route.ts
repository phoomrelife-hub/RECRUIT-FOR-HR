import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  ids: z.array(z.string()).min(1),
  positionId: z.string(),
});

// POST /api/candidates/bulk-assign-position
// Body: { ids: string[], positionId: string }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { ids, positionId } = body;

  // Verify position exists
  const position = await db.jobPosition.findUnique({
    where: { id: positionId },
    select: { id: true, title: true },
  });
  if (!position) {
    return NextResponse.json({ error: "Position not found" }, { status: 404 });
  }

  // Bulk update
  const result = await db.candidate.updateMany({
    where: { id: { in: ids } },
    data: { interestedPositionId: positionId },
  });

  return NextResponse.json({ updated: result.count, position: position.title });
}
