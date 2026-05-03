import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAiOverview } from "@/lib/ai/ai-config.service";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await getAiOverview();
  return NextResponse.json(data);
}
