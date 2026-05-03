import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quickReplies = await db.quickReply.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ quickReplies });
}
