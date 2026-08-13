import { db } from "@/lib/db";
import { NextResponse, after } from "next/server";
import { fuzzyMatchPosition } from "@/lib/position-match";
import { assessCandidate } from "@/lib/qualifier";

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

  // entry.646211752 carries the channel user id, prefilled by the bot:
  // a LINE userId ("U" + hex) or a Facebook PSID (all digits).
  const submittedId = typeof body.lineUserId === "string" ? body.lineUserId.trim() : "";
  const isFb = /^\d+$/.test(submittedId);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const positionTitle = typeof body.position === "string" ? body.position.trim() : undefined;
  const resumeUrl = typeof body.resumeUrl === "string" ? body.resumeUrl.trim() : undefined;
  const portfolioUrl = typeof body.portfolioUrl === "string" ? body.portfolioUrl.trim() : undefined;
  const notionPageId = typeof body.notionPageId === "string" ? body.notionPageId.trim() : undefined;
  const experienceText = typeof body.experienceText === "string" ? body.experienceText.trim() : undefined;

  if (!submittedId) {
    return NextResponse.json({ error: "user id is required" }, { status: 400 });
  }

  // ── look up job position (fuzzy match) ───────────────────────────────────
  let interestedPositionId: string | undefined;
  if (positionTitle) {
    const allPositions = await db.jobPosition.findMany({
      where: { status: { in: ["OPEN", "DRAFT"] } },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    });
    interestedPositionId = fuzzyMatchPosition(positionTitle, allPositions)?.id;
  }

  // ── find or upsert candidate ──────────────────────────────────────────────
  const existing = isFb
    ? await db.candidate.findUnique({ where: { facebookUserId: submittedId } })
    : await db.candidate.findUnique({ where: { lineUserId: submittedId } });

  const placeholderName = isFb ? "Facebook User" : "LINE User";

  let candidate;
  if (!existing) {
    // New candidate created from form submission (no prior conversation)
    candidate = await db.candidate.create({
      data: {
        ...(isFb ? { facebookUserId: submittedId } : { lineUserId: submittedId }),
        nickname: name || placeholderName,
        fullName: name || null,
        phone: phone ?? null,
        sourceChannel: isFb ? "FACEBOOK" : "LINE",
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
        ...(name && existing.nickname === placeholderName ? { nickname: name } : {}),
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
      data: { candidateId: candidate.id, channel: isFb ? "FACEBOOK" : "LINE" },
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

  // Background, not fire-and-forget: on Vercel, work started but not awaited
  // before the response is sent can be frozen/torn down mid-call — `after()`
  // keeps the function alive until this finishes while still returning the
  // HTTP response immediately. An assessment failure must never fail the
  // intake webhook, so errors are only logged.
  if (candidate.notionPageId) {
    const candidateId = candidate.id;
    after(async () => {
      try {
        // Idempotency: Apps Script may retry the webhook. If an assessment
        // already exists for this candidate, skip — otherwise two runs would
        // race on the same candidate (two paid Claude calls, and the two
        // upserts can collide on the candidate_id unique index). A manual
        // re-run through the API route is unaffected — it always reassesses.
        const already = await db.candidateAssessment.findUnique({
          where: { candidateId },
          select: { id: true },
        });
        if (already) return;

        await assessCandidate(candidateId);
      } catch (err) {
        console.error("[qualifier] auto-assess failed", candidateId, err);
      }
    });
  }

  return NextResponse.json({ ok: true, candidateId: candidate.id });
}
