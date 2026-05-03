import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { savePlaygroundRun, listPlaygroundRuns } from "@/lib/ai/ai-playground.service";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const run = await savePlaygroundRun({ ...body, createdById: session.user.id });
  return NextResponse.json(run);
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const runs = await listPlaygroundRuns();
  return NextResponse.json(runs);
}
