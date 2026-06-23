import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

// GET /api/assistant/sessions/[id]/messages — returns the user's own session thread.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  // Confirm the session belongs to the current user before returning its messages.
  const owned = await prisma.assistantSession.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rows = await prisma.assistantMessage.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  return NextResponse.json({
    messages: rows.map((m) => ({ role: m.role, content: m.content })),
  });
}
