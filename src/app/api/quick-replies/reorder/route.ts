import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role === "HR_STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { ids } = parsed.data;
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "Duplicate ids" }, { status: 400 });
  }

  // One transaction, not N requests: a half-applied reorder leaves duplicate
  // sortOrder values, and sortOrder decides which four chips the chat shows.
  try {
    await db.$transaction(
      ids.map((id, index) => db.quickReply.update({ where: { id }, data: { sortOrder: index } }))
    );
  } catch (error: unknown) {
    // P2025 = record not found (e.g., template deleted in another browser tab)
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Quick reply not found" }, { status: 404 });
    }
    throw error;
  }

  const quickReplies = await db.quickReply.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ quickReplies });
}
