import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAiLogs, getAiLogStats } from "@/lib/ai/ai-logs.service";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? undefined;
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const statsOnly = searchParams.get("stats") === "true";

  if (statsOnly) {
    const stats = await getAiLogStats();
    return NextResponse.json(stats);
  }

  const data = await listAiLogs({ action, page, limit });
  return NextResponse.json(data);
}
