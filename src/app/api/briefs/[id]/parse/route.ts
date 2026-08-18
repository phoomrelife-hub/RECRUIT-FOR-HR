import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { AiNotConfiguredError } from "@/lib/brief/ai";
import { briefHash } from "@/lib/brief/hash";
import { parseBrief } from "@/lib/brief/parse";
import { briefFilters } from "@/lib/brief/run";
import type { Prisma } from "@prisma/client";

// POST /api/briefs/[id]/parse — body: { rawBrief }
//
// Turns the free-text "อื่นๆที่ต้องการ" box into weighted scoring criteria.
// This is the ONLY endpoint that spends money on a brief, which is why it is
// behind its own button rather than riding on every field edit.
//
// It deliberately ignores whatever numbers the parser finds: age, salary and the
// rest now come from real inputs HR typed, and letting a model overwrite those
// would make the fields feel haunted.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.hiringBrief.findUnique({
    where: { id },
    include: { jobPosition: { select: { title: true } } },
  });
  if (!existing) return NextResponse.json({ error: "ไม่พบบรีฟ" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const rawBrief = typeof body.rawBrief === "string" ? body.rawBrief.trim() : "";

  // Clearing the box is a valid edit: it drops the soft criteria and leaves the
  // hard filters doing the work, with no API call.
  if (!rawBrief) {
    const filters = briefFilters(existing);
    const brief = await db.hiringBrief.update({
      where: { id },
      data: {
        rawBrief: "",
        criteria: [] as unknown as Prisma.InputJsonValue,
        briefHash: briefHash({ filters, criteria: [] }, existing.minProximity),
      },
    });
    return NextResponse.json({ brief, criteria: [], cleared: true });
  }

  let parsed;
  try {
    ({ parsed } = await parseBrief(rawBrief, existing.jobPosition.title));
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "อ่านข้อความไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const filters = briefFilters(existing);
  const hash = briefHash({ filters, criteria: parsed.criteria }, existing.minProximity);

  const brief = await db.hiringBrief.update({
    where: { id },
    data: {
      rawBrief,
      criteria: parsed.criteria as unknown as Prisma.InputJsonValue,
      briefHash: hash,
    },
  });

  return NextResponse.json({
    brief,
    criteria: parsed.criteria,
    hashChanged: hash !== existing.briefHash,
  });
}
