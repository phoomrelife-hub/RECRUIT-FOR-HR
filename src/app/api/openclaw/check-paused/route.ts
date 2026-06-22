// GET /api/openclaw/check-paused?lineUserId=xxx
// Called by middleware.py to check if HR has taken over (bot should not respond).
// No auth required — added to proxy.ts whitelist.
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // middleware.py passes the user id in `lineUserId` for both channels.
  // LINE ids start with "U"; Facebook PSIDs are all digits → look up either.
  const id = searchParams.get("lineUserId");
  const NC = { headers: { "Cache-Control": "no-store" } };
  if (!id) return NextResponse.json({ paused: false }, NC);

  const candidate = /^\d+$/.test(id)
    ? await db.candidate.findUnique({ where: { facebookUserId: id } })
    : await db.candidate.findUnique({ where: { lineUserId: id } });
  if (!candidate) return NextResponse.json({ paused: false }, NC);

  const conversation = await db.conversation.findFirst({
    where: { candidateId: candidate.id, status: { not: "CLOSED" } },
    select: { id: true },
  });
  if (!conversation) return NextResponse.json({ paused: false }, NC);

  // ดู HumanTakeover record ล่าสุด — ถ้า action=TAKE_OVER = HR ยังดูอยู่ = paused
  const lastTakeover = await db.humanTakeover.findFirst({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    select: { action: true },
  });

  return NextResponse.json(
    { paused: lastTakeover?.action === "TAKE_OVER" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
