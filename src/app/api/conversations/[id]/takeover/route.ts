import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const takeoverSchema = z.object({
  action: z.enum(["TAKE_OVER", "RELEASE"]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const conversation = await db.conversation.findUnique({ where: { id } });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = takeoverSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { action } = parsed.data;
  const botEnabled = action === "RELEASE";

  await db.$transaction([
    db.conversation.update({
      where: { id },
      data: { botEnabled },
    }),
    db.humanTakeover.create({
      data: {
        conversationId: id,
        hrId: session.user.id,
        action,
      },
    }),
    db.message.create({
      data: {
        conversationId: id,
        content:
          action === "TAKE_OVER"
            ? `HR (${session.user.name}) รับช่วงการสนทนาแล้ว บอทหยุดทำงานชั่วคราว`
            : `HR (${session.user.name}) คืนการสนทนาให้บอทแล้ว`,
        senderType: "SYSTEM",
      },
    }),
    db.auditLog.create({
      data: {
        userId: session.user.id,
        action: action === "TAKE_OVER" ? "TAKEOVER_CONVERSATION" : "RESUME_BOT",
        targetId: id,
        targetType: "Conversation",
      },
    }),
  ]);

  return NextResponse.json({ success: true, botEnabled });
}
