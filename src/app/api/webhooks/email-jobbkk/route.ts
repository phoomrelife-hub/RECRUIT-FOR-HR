import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { fuzzyMatchPosition } from "@/lib/position-match";

// ── POST /api/webhooks/email-jobbkk ──────────────────────────────────────────
// Called by Make.com — receives raw email content, parses on server side.
// Security: x-webhook-secret header must match WEBHOOK_JOBBKK_SECRET env var
//
// Payload (new format — Make.com sends raw email):
// {
//   emailText: string    — plain text of the email (1.text from Gmail module)
//   emailHtml?: string   — HTML of the email (1.html)
//   subject?: string     — email subject (1.subject)
//   source?: "JOBBKK"|"JOBTHAI"
// }

// ── JobBKK email parser ───────────────────────────────────────────────────────
function parseJobBkkEmail(text: string, subject?: string) {
  const t = text ?? "";

  // ── fullName: Thai name appearing before "เพศ" label ─────────────────────
  const nameMatch =
    t.match(/([ก-๙a-zA-Z][ก-๙a-zA-Z\s]{1,40})\s*\n\s*เพศ/) ??
    t.match(/^([ก-๙]{2,}(?:\s[ก-๙]{2,})+)/m);
  const fullName = nameMatch?.[1]?.trim() ?? "";

  // ── phone: โทรศัพท์ or มือถือ ────────────────────────────────────────────
  const phoneMatch = t.match(/(?:โทรศัพท์|มือถือ)[:\s]*([0-9][\d\-]{8,12})/);
  const phone = phoneMatch?.[1]?.replace(/\D/g, "") || undefined;

  // ── email: first non-jobbkk/non-relife email address ─────────────────────
  const emailMatches = [...t.matchAll(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)];
  const email = emailMatches
    .map((m) => m[1])
    .find((e) => !e.includes("jobbkk") && !e.includes("relife"));

  // ── position: from subject "Application letter in X" or "ตำแหน่ง: X" ──────
  let positionTitle: string | undefined;
  if (subject) {
    const subjectMatch =
      subject.match(/Application letter in (.+)/i) ??
      subject.match(/ตำแหน่ง[:\s]+(.+)/);
    positionTitle = subjectMatch?.[1]?.trim();
  }
  if (!positionTitle) {
    const posMatch = t.match(/(?:ตำแหน่งที่สมัคร|ตำแหน่ง)[:\s]+(.+)/);
    positionTitle = posMatch?.[1]?.trim();
  }

  // ── expectedSalary: เงินเดือน ─────────────────────────────────────────────
  const salaryMatch = t.match(/เงินเดือน[^:\d]*[:\s]+([\d,]+)/);
  const expectedSalary = salaryMatch
    ? parseInt(salaryMatch[1].replace(/,/g, ""), 10) || undefined
    : undefined;

  // ── experienceText: section ประสบการณ์การทำงาน ────────────────────────────
  const expMatch = t.match(/ประสบการณ์การทำงาน\s*\n+([\s\S]+?)(?:\n{2,}|\n[ก-๙A-Z])/);
  const experienceText = expMatch?.[1]?.trim() || undefined;

  // ── resumeUrl: jobbkk resume link ─────────────────────────────────────────
  const urlMatch = t.match(/(https?:\/\/(?:www\.)?jobbkk\.com\/resumes\/[^\s]+)/);
  const resumeUrl = urlMatch?.[1] || undefined;

  return { fullName, phone, email, positionTitle, expectedSalary, experienceText, resumeUrl };
}

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = req.headers.get("x-webhook-secret");
  if (
    process.env.WEBHOOK_JOBBKK_SECRET &&
    secret !== process.env.WEBHOOK_JOBBKK_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const source = body.source === "JOBTHAI" ? "JOBTHAI" as const : "JOBBKK" as const;

  // ── Detect payload format ─────────────────────────────────────────────────
  // New format: { emailText, subject } — server parses
  // Legacy format: { fullName, email, phone, ... } — direct fields
  let fullName: string;
  let email: string | undefined;
  let phone: string | undefined;
  let positionTitle: string | undefined;
  let expectedSalary: number | undefined;
  let experienceText: string | undefined;
  let resumeUrl: string | undefined;

  if (typeof body.emailText === "string") {
    // ── New format: parse from raw email ──────────────────────────────────
    const subject = typeof body.subject === "string" ? body.subject : undefined;
    const parsed = parseJobBkkEmail(body.emailText, subject);
    fullName = parsed.fullName;
    email = parsed.email;
    phone = parsed.phone;
    positionTitle = parsed.positionTitle;
    expectedSalary = parsed.expectedSalary;
    experienceText = parsed.experienceText;
    resumeUrl = parsed.resumeUrl;
  } else {
    // ── Legacy format: direct fields ──────────────────────────────────────
    fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    email = typeof body.email === "string" ? body.email.trim() : undefined;
    phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
    positionTitle = typeof body.position === "string" ? body.position.trim() : undefined;
    expectedSalary = typeof body.expectedSalary === "number" ? body.expectedSalary : undefined;
    experienceText = typeof body.experienceText === "string" ? body.experienceText.trim() : undefined;
    resumeUrl = typeof body.resumeUrl === "string" ? body.resumeUrl.trim() : undefined;
  }

  if (!fullName) {
    return NextResponse.json({ error: "Could not extract fullName from email" }, { status: 400 });
  }

  // ── Match position ────────────────────────────────────────────────────────
  let interestedPositionId: string | undefined;
  if (positionTitle) {
    const allPositions = await db.jobPosition.findMany({
      where: { status: { in: ["OPEN", "DRAFT"] } },
      select: { id: true, title: true },
    });
    interestedPositionId = fuzzyMatchPosition(positionTitle, allPositions)?.id;
  }

  // ── Create candidate ──────────────────────────────────────────────────────
  const candidate = await db.candidate.create({
    data: {
      fullName,
      nickname: fullName.split(" ")[0] || fullName,
      email: email ?? null,
      phone: phone ?? null,
      sourceChannel: source,
      currentStatus: "WAITING_HR_REVIEW",
      interestedPositionId: interestedPositionId ?? null,
      expectedSalary: expectedSalary ?? null,
      experienceText: experienceText ?? null,
      resumeUrl: resumeUrl ?? null,
    },
  });

  await db.candidateStatusHistory.create({
    data: {
      candidateId: candidate.id,
      fromStatus: null,
      toStatus: "WAITING_HR_REVIEW",
      reason: `สมัครผ่าน ${source}`,
    },
  });

  // ── Create conversation + SYSTEM message ──────────────────────────────────
  const conversation = await db.conversation.create({
    data: { candidateId: candidate.id, channel: "LINE" },
  });

  const parts: string[] = [`📧 ใบสมัครจาก ${source}`];
  if (fullName) parts.push(`ชื่อ: ${fullName}`);
  if (phone) parts.push(`เบอร์: ${phone}`);
  if (email) parts.push(`Email: ${email}`);
  if (positionTitle) parts.push(`ตำแหน่ง: ${positionTitle}`);
  if (experienceText) parts.push(`ประสบการณ์: ${experienceText}`);
  if (expectedSalary) parts.push(`เงินเดือนที่ต้องการ: ${expectedSalary.toLocaleString()} บาท`);
  if (resumeUrl) parts.push(`Resume: ${resumeUrl}`);

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

  return NextResponse.json({
    ok: true,
    candidateId: candidate.id,
    parsed: { fullName, phone, email, positionTitle, expectedSalary },
  });
}
