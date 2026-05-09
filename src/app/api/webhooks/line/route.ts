import { db } from "@/lib/db";
import { verifyLineSignature, getLineProfile, pushMessage, type LineWebhookPayload } from "@/lib/line";
import { NextResponse } from "next/server";

// Direct LINE webhook receiver
// Production flow: LINE → Cloudflare tunnel → middleware.py → OpenClaw → openclaw/sync
// This route handles LINE messages if the webhook is pointed directly at Vercel.

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  const valid = await verifyLineSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload: LineWebhookPayload = JSON.parse(rawBody);

  for (const event of payload.events) {
    if (event.type !== "message") continue;

    const msgType = event.message.type;
    if (!["text", "image", "file"].includes(msgType)) continue;

    const lineUserId = event.source.userId;
    const externalId = event.message.id;
    const textContent = msgType === "text" ? (event.message as { text: string }).text.trim() : "";

    // ── Quick Reply: interview confirmation ──────────────────────────────
    if (msgType === "text" && (textContent === "สะดวก" || textContent === "ไม่สะดวก")) {
      await handleInterviewResponse(lineUserId, textContent as "สะดวก" | "ไม่สะดวก");
      // Still fall through to save message in conversation
    }

    const lineProfile = await getLineProfile(lineUserId);

    // find or create candidate
    let candidate = await db.candidate.findUnique({ where: { lineUserId } });
    if (!candidate) {
      candidate = await db.candidate.create({
        data: {
          nickname: lineProfile?.displayName ?? "LINE User",
          lineUserId,
          lineDisplayName: lineProfile?.displayName ?? null,
          lineProfilePicUrl: lineProfile?.pictureUrl ?? null,
          sourceChannel: "LINE",
          currentStatus: "NEW_APPLICANT",
        },
      });
    } else if (lineProfile) {
      candidate = await db.candidate.update({
        where: { id: candidate.id },
        data: {
          lineDisplayName: lineProfile.displayName,
          lineProfilePicUrl: lineProfile.pictureUrl ?? null,
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

    // build message content
    let content = "";
    let mediaUrl: string | null = null;

    if (msgType === "text") {
      content = textContent;
    } else if (msgType === "image") {
      content = "[📷 รูปภาพ]";
      mediaUrl = `/api/media/line/${externalId}`;
    } else if (msgType === "file") {
      const fileName = (event.message as { fileName?: string }).fileName ?? "ไฟล์แนบ";
      content = `[📎 ${fileName}]`;
      mediaUrl = `/api/media/line/${externalId}`;
    }

    // save candidate message
    await db.message.create({
      data: {
        conversationId: conversation.id,
        content,
        messageType: msgType,
        mediaUrl,
        senderType: "CANDIDATE",
        externalId,
      },
    });

    // auto-promote NEW_APPLICANT → BOT_SCREENING
    if (candidate.currentStatus === "NEW_APPLICANT") {
      await db.candidate.update({ where: { id: candidate.id }, data: { currentStatus: "BOT_SCREENING" } });
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
  }

  return NextResponse.json({ ok: true });
}

// ── Handle interview quick reply response ─────────────────────────────────────

async function handleInterviewResponse(
  lineUserId: string,
  response: "สะดวก" | "ไม่สะดวก"
): Promise<void> {
  try {
    const candidate = await db.candidate.findUnique({
      where: { lineUserId },
      select: { id: true, fullName: true, nickname: true, lineDisplayName: true, currentStatus: true },
    });

    if (!candidate || candidate.currentStatus !== "INTERVIEW_SCHEDULED") return;

    // Find the latest SCHEDULED interview for this candidate
    const interview = await db.interview.findFirst({
      where: { candidateId: candidate.id, status: "SCHEDULED" },
      orderBy: { createdAt: "desc" },
    });

    if (!interview) return;

    const candidateResponse = response === "สะดวก" ? "confirmed" : "declined";

    // Update interview candidateResponse
    await db.interview.update({
      where: { id: interview.id },
      data: { candidateResponse, respondedAt: new Date() },
    });

    // If declined: push a follow-up message
    if (candidateResponse === "declined") {
      const name = candidate.fullName ?? candidate.nickname ?? candidate.lineDisplayName ?? "คุณ";
      try {
        await pushMessage(
          lineUserId,
          `ขอบคุณที่แจ้งให้ทราบนะคะ ${name} 🙏\n\nทางทีมจะติดต่อเพื่อนัดวันและเวลาใหม่ที่สะดวกกว่านี้ให้ค่ะ 📅`
        );
      } catch {
        // non-critical, ignore
      }
    }
  } catch (err) {
    console.error("handleInterviewResponse error:", err);
  }
}
