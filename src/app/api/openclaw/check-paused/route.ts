// GET /api/openclaw/check-paused?lineUserId=xxx
// Called by middleware.py to check if HR has taken over (bot should not respond).
// No auth required — added to proxy.ts whitelist.
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lineUserId = searchParams.get("lineUserId");
  const NC = { headers: { "Cache-Control": "no-store" } };
  if (!lineUserId) return NextResponse.json({ paused: false }, NC);

  const candidate = await db.candidate.findUnique({ where: { lineUserId } });
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
