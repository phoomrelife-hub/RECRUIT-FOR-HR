import { NextResponse } from "next/server";
import { notifyPending } from "@/lib/brief/notify";

// GET /api/cron/brief-digest
//
// Daily roll-up of everyone below each brief's instant threshold. Five-star
// finds have already gone out one at a time as they were scored; this sweeps up
// the rest and also acts as the retry path for any instant send that failed.
//
// Auth matches the existing interview-reminders cron: Bearer CRON_SECRET.

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await notifyPending(false);
  return NextResponse.json({ ok: true, ...summary });
}
