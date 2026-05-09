import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pushMessage } from "@/lib/line";
import { NextResponse } from "next/server";

const MSG_PASS = `หวัดดีค้าา~ 🎉
ยินดีด้วยนะคะ! ทางทีม Relife ได้พิจารณาใบสมัครของคุณแล้ว
และอยากเชิญคุณมาคุยกันเพิ่มเติมค่ะ 🥳
ทางทีมจะติดต่อกลับเพื่อนัดวันและเวลาสัมภาษณ์เร็วๆ นี้นะคะ 📅
ฝากติดตาม inbox ไว้ด้วยนะคะ~
ขอบคุณมากค่า ❤️
— ทีม Relife Solutions`;

const MSG_FAIL = `หวัดดีค้าา~ ขอบคุณมากๆ เลยนะคะที่สนใจมาร่วมทีม Relife 🥰
ทางทีมได้อ่านใบสมัครของคุณแล้วค่ะ ครั้งนี้อาจจะยังไม่ match กันพอดีซักนิด
แต่ไม่ได้แปลว่าไม่เก่งนะคะ 💪
ถ้าในอนาคตมีตำแหน่งที่ใช่ จะทักกลับมาเลยค่า ฝากติดตาม Relife ไว้ด้วยนะคะ 🌟
ขอบคุณอีกครั้งค้าา ❤️
— ทีม Relife Solutions`;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const result = body.result as string;

  if (!["pass", "fail"].includes(result)) {
    return NextResponse.json({ error: 'result must be "pass" or "fail"' }, { status: 400 });
  }

  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const isPass = result === "pass";
  const newStatus = isPass ? "QUALIFIED" : "REJECTED";
  const messageText = isPass ? MSG_PASS : MSG_FAIL;

  // ── update candidate status ───────────────────────────────────────────────
  const prevStatus = candidate.currentStatus;
  if (prevStatus !== newStatus) {
    await db.candidate.update({
      where: { id },
      data: { currentStatus: newStatus },
    });
    await db.candidateStatusHistory.create({
      data: {
        candidateId: id,
        fromStatus: prevStatus,
        toStatus: newStatus,
        changedById: session.user.id,
        reason: `Qualify decision by HR: ${isPass ? "✅ ผ่าน" : "❌ ไม่ผ่าน"}`,
      },
    });
  }

  // ── save message to inbox ─────────────────────────────────────────────────
  let conversation = await db.conversation.findFirst({
    where: { candidateId: id, status: { not: "CLOSED" } },
    orderBy: { createdAt: "desc" },
  });
  if (!conversation) {
    conversation = await db.conversation.create({
      data: { candidateId: id, channel: "LINE" },
    });
  }
  await db.message.create({
    data: {
      conversationId: conversation.id,
      content: messageText,
      senderType: "HR",
      senderId: session.user.id,
      createdAt: new Date(),
    },
  });
  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), status: "ACTIVE" },
  });

  // ── send LINE push ────────────────────────────────────────────────────────
  let lineSent = false;
  let lineError: string | null = null;
  if (candidate.lineUserId) {
    try {
      await pushMessage(candidate.lineUserId, messageText);
      lineSent = true;
    } catch (err) {
      lineError = err instanceof Error ? err.message : String(err);
      console.error("[qualify] LINE push failed:", lineError);
    }
  }

  // ── patch Notion if notionPageId is stored ────────────────────────────────
  let notionPatched = false;
  if (candidate.notionPageId && process.env.NOTION_TOKEN) {
    try {
      const notionRes = await fetch(
        `https://api.notion.com/v1/pages/${candidate.notionPageId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify({
            properties: {
              Qualify: {
                select: { name: isPass ? "✅ ผ่าน" : "❌ ไม่ผ่าน" },
              },
              "ส่งแจ้งผลแล้ว": { checkbox: true },
            },
          }),
        }
      );
      notionPatched = notionRes.ok;
      if (!notionRes.ok) {
        const err = await notionRes.text();
        console.error("[qualify] Notion PATCH failed:", err);
      }
    } catch (err) {
      console.error("[qualify] Notion PATCH error:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    status: newStatus,
    lineSent,
    notionPatched,
    ...(lineError ? { lineError } : {}),
  });
}
