import crypto from "crypto";
import { db } from "@/lib/db";
import { getLineProfile, pushMessage } from "@/lib/line";
import { sanitizeBotReply } from "@/lib/sanitize-bot-reply";
import { applyKeywordTagging } from "@/lib/auto-tag";
import { NextResponse } from "next/server";

// OpenClaw calls this endpoint after Daniel-hr sends/receives a LINE message
// Payload from OpenClaw:
// {
//   lineUserId: string
//   displayName?: string
//   userMessage: string       — candidate's message
//   botReply?: string         — Daniel-hr's reply (null if HR takeover)
//   externalMessageId?: string
// }

export async function POST(req: Request) {
  // Verify shared secret
  const secret = req.headers.get("x-openclaw-secret");
  if (
    process.env.OPENCLAW_SYNC_SECRET &&
    secret !== process.env.OPENCLAW_SYNC_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    lineUserId,
    displayName,
    pictureUrl,
    userMessage,
    botReply,
    externalMessageId,
    messageType,   // "text" | "image" | "file" — from middleware.py
    mediaLineId,   // LINE message ID for image/file proxy
  } = body;

  // Allow either userMessage OR botReply (or both) — at least one is required
  if (!lineUserId || (!userMessage && !botReply)) {
    return NextResponse.json(
      { error: "lineUserId required, plus at least userMessage or botReply" },
      { status: 400 }
    );
  }

  // ใช้ profile ที่ middleware ส่งมา (ดึงจาก LINE API แล้ว) — fallback getLineProfile ถ้าไม่มี
  let resolvedDisplayName = displayName ?? null;
  let resolvedPictureUrl = pictureUrl ?? null;

  if (!resolvedDisplayName || !resolvedPictureUrl) {
    const lineProfile = await getLineProfile(lineUserId);
    resolvedDisplayName = resolvedDisplayName ?? lineProfile?.displayName ?? null;
    resolvedPictureUrl = resolvedPictureUrl ?? lineProfile?.pictureUrl ?? null;
  }

  const finalDisplayName = resolvedDisplayName ?? "LINE User";

  // find or create candidate by lineUserId
  let candidate = await db.candidate.findUnique({ where: { lineUserId } });
  if (!candidate) {
    candidate = await db.candidate.create({
      data: {
        nickname: finalDisplayName,
        lineUserId,
        lineDisplayName: resolvedDisplayName,
        lineProfilePicUrl: resolvedPictureUrl,
        sourceChannel: "LINE",
        currentStatus: "NEW_APPLICANT",
      },
    });
  } else {
    // refresh profile ทุกครั้งที่มี message เข้า (keeps pic URL alive)
    candidate = await db.candidate.update({
      where: { id: candidate.id },
      data: {
        ...(resolvedDisplayName ? { lineDisplayName: resolvedDisplayName } : {}),
        ...(resolvedPictureUrl ? { lineProfilePicUrl: resolvedPictureUrl } : {}),
        ...(candidate.nickname === "LINE User" && finalDisplayName !== "LINE User"
          ? { nickname: finalDisplayName }
          : {}),
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

  // anchor timestamp so user message always sorts before bot reply
  const userMsgAt = new Date();

  // save candidate message (only when userMessage is provided)
  if (userMessage) {
    const existing = externalMessageId
      ? await db.message.findFirst({ where: { externalId: externalMessageId } })
      : null;

    if (!existing) {
      const resolvedType = messageType ?? "text";
      const resolvedMediaUrl = mediaLineId ? `/api/media/line/${mediaLineId}` : null;
      await db.message.create({
        data: {
          conversationId: conversation.id,
          content: userMessage,
          messageType: resolvedType,
          mediaUrl: resolvedMediaUrl,
          senderType: "CANDIDATE",
          externalId: externalMessageId ?? null,
          createdAt: userMsgAt,
        },
      });
    } else if (
      // Race-condition fix: outbound_dedup.py may create the record first (as "text")
      // before middleware.py's thread arrives with proper messageType + mediaLineId.
      // If we now have better media info, upgrade the existing record in-place.
      messageType &&
      messageType !== "text" &&
      existing.messageType === "text" &&
      mediaLineId
    ) {
      await db.message.update({
        where: { id: existing.id },
        data: {
          messageType,
          mediaUrl: `/api/media/line/${mediaLineId}`,
          content: userMessage, // update from "[media]" → "[📷 รูปภาพ]"
        },
      });
    }

    // ── Quick Reply: interview confirmation ────────────────────────────────
    const trimmed = userMessage.trim();
    if (
      (trimmed === "สะดวก" || trimmed === "ไม่สะดวก") &&
      candidate.currentStatus === "INTERVIEW_SCHEDULED"
    ) {
      await handleInterviewResponse(
        candidate.id,
        lineUserId,
        candidate.fullName ?? candidate.nickname ?? candidate.lineDisplayName ?? "คุณ",
        trimmed as "สะดวก" | "ไม่สะดวก"
      );
    }

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
          reason: "OpenClaw LINE conversation started",
        },
      });
    }

    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: "ACTIVE", unreadCount: { increment: 1 } },
    });

    // ── Keyword Auto Tagging ─────────────────────────────────────────────────
    // Run non-blocking — tagging failure must not break the sync response
    applyKeywordTagging(candidate.id, userMessage).catch((err) =>
      console.error("[auto-tag] keyword tagging error:", err)
    );
  }

  // save bot reply if present (skip backfill sentinel)
  if (botReply && botReply !== "__profile_backfill__") {
    const cleanReply = sanitizeBotReply(botReply);
    // always 2s after user message so sort order is deterministic
    const botReplyAt = new Date(userMsgAt.getTime() + 2000);
    await db.message.create({
      data: {
        conversationId: conversation.id,
        content: cleanReply,
        senderType: "BOT",
        createdAt: botReplyAt,
      },
    });

    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, conversationId: conversation.id });
}

// ── Interview Quick Reply handler ─────────────────────────────────────────────

async function handleInterviewResponse(
  candidateId: string,
  lineUserId: string,
  name: string,
  response: "สะดวก" | "ไม่สะดวก"
) {
  try {
    const interview = await db.interview.findFirst({
      where: { candidateId, status: "SCHEDULED" },
      orderBy: { createdAt: "desc" },
    });
    if (!interview || interview.candidateResponse) return; // already answered

    await db.interview.update({
      where: { id: interview.id },
      data: {
        candidateResponse: response === "สะดวก" ? "confirmed" : "declined",
        respondedAt: new Date(),
      },
    });

    if (response === "ไม่สะดวก") {
      await pushMessage(
        lineUserId,
        `ขอบคุณที่แจ้งให้ทราบนะคะ คุณ${name} 🙏\nทางทีมจะติดต่อกลับเพื่อนัดวันที่สะดวกให้ค่ะ 😊`
      ).catch(() => null);
    }
  } catch (err) {
    console.error("handleInterviewResponse error:", err);
  }
}
