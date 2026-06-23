import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessions = await prisma.assistantSession.findMany({
    where: { userId },
    select: { id: true, title: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ sessions });
}

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const created = await prisma.assistantSession.create({
    data: { userId, title: "แชทใหม่" },
    select: { id: true, title: true },
  });
  return NextResponse.json({ session: created });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  // user-scoped delete (cannot delete others' sessions)
  await prisma.assistantSession.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
