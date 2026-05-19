import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/inbox/init
 * Returns secondary data for the inbox that is not needed on initial render:
 * - quickReplies
 * - allTags
 * - hrUsers (active, id+name only)
 *
 * Called client-side on mount to keep the server-side page.tsx fast.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [quickReplies, tags, hrUsers] = await Promise.all([
    db.quickReply.findMany({ orderBy: { sortOrder: "asc" } }),
    db.tag.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ quickReplies, tags, hrUsers });
}
