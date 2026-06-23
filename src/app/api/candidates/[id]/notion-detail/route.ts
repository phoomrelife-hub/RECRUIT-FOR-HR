import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getNotionDetail } from "@/lib/notion-detail";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await auth();

  const { id } = await params;
  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) {
    return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });
  }

  const candidate = await db.candidate.findUnique({
    where: { id },
    select: { notionPageId: true },
  });

  if (!candidate?.notionPageId) {
    return NextResponse.json({ error: "no_notion_page" }, { status: 404 });
  }

  try {
    const detail = await getNotionDetail(candidate.notionPageId, notionToken);
    return NextResponse.json(detail);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[notion-detail] fetch error:", msg, "pageId:", candidate.notionPageId);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
