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
    select: { id: true, botEnabled: true },
  });
  if (!conversation) return NextResponse.json({ paused: false }, NC);

  // Two sources of truth must BOTH be honoured here, or the bot keeps replying
  // after HR takes over:
  //   1. conversation.botEnabled — toggled by the takeover route, the bot's own
  //      handoff (openclaw/webhook), and legacy takeovers that predate the
  //      HumanTakeover-based check. botEnabled=false ALWAYS means "bot off".
  //   2. latest HumanTakeover record — explicit HR TAKE_OVER/RELEASE action.
  // Pause if EITHER says so (superset). Relying on HumanTakeover alone missed
  // every conversation paused via botEnabled without a takeover row.
  if (conversation.botEnabled === false) {
    return NextResponse.json({ paused: true }, NC);
  }

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
