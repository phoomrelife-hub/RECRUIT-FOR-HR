import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// Called by Google Apps Script after onFormSubmit → Notion write
// Payload:
// {
//   lineUserId: string        — pre-filled from LINE bot URL (entry.646211752)
//   name: string              — ชื่อ - นามสกุล / ชื่อเล่น
//   phone?: string            — เบอร์โทรติดต่อ
//   position?: string         — ตำแหน่งที่สมัคร
//   resumeUrl?: string        — Notion attachment URL (optional)
//   portfolioUrl?: string     — Notion attachment URL (optional)
// }
//
// Security: x-webhook-secret header must match WEBHOOK_FORM_SECRET env var

export async function POST(req: Request) {
  // ── auth ──────────────────────────────────────────────────────────────────
  const secret = req.headers.get("x-webhook-secret");
  if (
    process.env.WEBHOOK_FORM_SECRET &&
    secret !== process.env.WEBHOOK_FORM_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const lineUserId = typeof body.lineUserId === "string" ? body.lineUserId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const positionTitle = typeof body.position === "string" ? body.position.trim() : undefined;
  const resumeUrl = typeof body.resumeUrl === "string" ? body.resumeUrl.trim() : undefined;
  const portfolioUrl = typeof body.portfolioUrl === "string" ? body.portfolioUrl.trim() : undefined;
  const notionPageId = typeof body.notionPageId === "string" ? body.notionPageId.trim() : undefined;
  const experienceText = typeof body.experienceText === "string" ? body.experienceText.trim() : undefined;

  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId is required" }, { status: 400 });
  }

  // ── look up job position ──────────────────────────────────────────────────
  let interestedPositionId: string | undefined;
  if (positionTitle) {
    const job = await db.jobPosition.findFirst({
      where: {
        title: { contains: positionTitle.substring(0, 30), mode: "insensitive" },
        status: { in: ["OPEN", "DRAFT"] },
      },
      orderBy: { createdAt: "asc" },
    });
    interestedPositionId = job?.id;
  }

  // ── find or upsert candidate ──────────────────────────────────────────────
  const existing = await db.candidate.findUnique({ where: { lineUserId } });

  let candidate;
  if (!existing) {
    // New candidate created from form submission (no prior LINE conversation)
    candidate = await db.candidate.create({
      data: {
        lineUserId,
        nickname: name || "LINE User",
        fullName: name || null,
        phone: phone ?? null,
        sourceChannel: "LINE",
        currentStatus: "WAITING_HR_REVIEW",
        interestedPositionId: interestedPositionId ?? null,
        resumeUrl: resumeUrl ?? null,
        portfolioUrl: portfolioUrl ?? null,
        notionPageId: notionPageId ?? null,
        experienceText: experienceText ?? null,
      },
    });

    await db.candidateStatusHistory.create({
      data: {
        candidateId: candidate.id,
        fromStatus: null,
        toStatus: "WAITING_HR_REVIEW",
        reason: "Form submission via Google Form (new candidate)",
      },
    });
  } else {
    // Existing candidate (already talked to bot) — update info + promote status
    const prevStatus = existing.currentStatus;
    const shouldPromote = ["NEW_APPLICANT", "BOT_SCREENING"].includes(prevStatus);

    candidate = await db.candidate.update({
      where: { id: existing.id },
      data: {
        ...(name ? { fullName: name } : {}),
        ...(name && existing.nickname === "LINE User" ? { nickname: name } : {}),
        ...(phone ? { phone } : {}),
        ...(interestedPositionId ? { interestedPositionId } : {}),
        ...(resumeUrl ? { resumeUrl } : {}),
        ...(portfolioUrl ? { portfolioUrl } : {}),
        ...(notionPageId ? { notionPageId } : {}),
        ...(experienceText ? { experienceText } : {}),
        ...(shouldPromote ? { currentStatus: "WAITING_HR_REVIEW" } : {}),
      },
    });

    if (shouldPromote) {
      await db.candidateStatusHistory.create({
        data: {
          candidateId: existing.id,
          fromStatus: prevStatus,
          toStatus: "WAITING_HR_REVIEW",
          reason: "Form submission via Google Form",
        },
      });
    }
  }

  // ── ensure conversation exists (so inbox shows the candidate) ─────────────
  const conv = await db.conversation.findFirst({
    where: { candidateId: candidate.id, status: { not: "CLOSED" } },
  });
  if (!conv) {
    await db.conversation.create({
      data: { candidateId: candidate.id, channel: "LINE" },
    });
  }

  // ── save a SYSTEM message as a form-submission receipt ────────────────────
  const conversation = conv ?? await db.conversation.findFirst({
    where: { candidateId: candidate.id },
  });

  if (conversation) {
    const parts: string[] = ["📋 ใบสมัครจาก Google Form"];
    if (name) parts.push(`ชื่อ: ${name}`);
    if (phone) parts.push(`เบอร์: ${phone}`);
    if (positionTitle) parts.push(`ตำแหน่ง: ${positionTitle}`);
    if (experienceText) parts.push(`ประสบการณ์: ${experienceText}`);
    if (resumeUrl) parts.push(`Resume: ${resumeUrl}`);
    if (portfolioUrl) parts.push(`Portfolio: ${portfolioUrl}`);

    await db.message.create({
      data: {
        conversationId: conversation.id,
        content: parts.join("\n"),
        senderType: "SYSTEM",
        createdAt: new Date(),
      },
    });

    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: "ACTIVE" },
    });
  }

  return NextResponse.json({ ok: true, candidateId: candidate.id });
}
