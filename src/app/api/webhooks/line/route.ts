import { db } from "@/lib/db";
import { verifyLineSignature, replyMessage, type LineWebhookPayload } from "@/lib/line";
import { getDanielReply } from "@/lib/daniel-bot";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  console.log("[LINE webhook] hit — signature:", signature ? "present" : "MISSING");
  console.log("[LINE webhook] body:", rawBody.slice(0, 200));

  const valid = verifyLineSignature(rawBody, signature);
  console.log("[LINE webhook] signature valid:", valid);

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload: LineWebhookPayload = JSON.parse(rawBody);

  for (const event of payload.events) {
    if (event.type !== "message" || event.message.type !== "text") continue;

    const lineUserId = event.source.userId;
    const messageText = event.message.text;
    const replyToken = event.replyToken;
    const externalId = event.message.id;

    // find or create candidate by lineUserId
    let candidate = await db.candidate.findUnique({ where: { lineUserId } });
    if (!candidate) {
      candidate = await db.candidate.create({
        data: {
          nickname: "LINE User",
          lineUserId,
          sourceChannel: "LINE",
          currentStatus: "NEW_APPLICANT",
        },
      });
    }

    // find or create active conversation
    let conversation = await db.conversation.findFirst({
      where: { candidateId: candidate.id, status: { not: "CLOSED" } },
    });
    if (!conversation) {
      conversation = await db.conversation.create({
        data: { candidateId: candidate.id, channel: "LINE" },
      });
    }

    // save candidate message
    await db.message.create({
      data: {
        conversationId: conversation.id,
        content: messageText,
        senderType: "CANDIDATE",
        externalId,
      },
    });

    // auto-promote NEW_APPLICANT → BOT_SCREENING
    if (candidate.currentStatus === "NEW_APPLICANT") {
      await db.candidate.update({
        where: { id: candidate.id },
        data: { currentStatus: "BOT_SCREENING" },
      });
      await db.candidateStatusHistory.create({
        data: {
          candidateId: candidate.id,
          fromStatus: "NEW_APPLICANT",
          toStatus: "BOT_SCREENING",
          reason: "LINE conversation started",
        },
      });
    }

    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: "ACTIVE", unreadCount: { increment: 1 } },
    });

    // bot reply if enabled
    if (conversation.botEnabled) {
      const candidateMsgCount = await db.message.count({
        where: { conversationId: conversation.id, senderType: "CANDIDATE" },
      });

      const recentMessages = await db.message.findMany({
        where: {
          conversationId: conversation.id,
          senderType: { in: ["CANDIDATE", "BOT"] },
        },
        orderBy: { createdAt: "asc" },
        take: 20,
      });

      const history = recentMessages.map((m) => ({
        role: (m.senderType === "CANDIDATE" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      }));

      const botReply = await getDanielReply(candidateMsgCount, history);

      if (botReply) {
        await db.message.create({
          data: {
            conversationId: conversation.id,
            content: botReply,
            senderType: "BOT",
          },
        });

        await db.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        });

        await replyMessage(replyToken, botReply);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
