import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { fuzzyMatchPosition } from "@/lib/position-match";

// ── POST /api/webhooks/email-jobbkk ──────────────────────────────────────────
// Called by Make.com after parsing a JobBKK application email.
// Security: x-webhook-secret header must match WEBHOOK_JOBBKK_SECRET env var
//
// Payload:
// {
//   fullName: string           — ชื่อ-นามสกุล
//   email?: string             — อีเมลผู้สมัคร
//   phone?: string             — เบอร์โทร / มือถือ
//   position?: string          — ตำแหน่งที่สมัคร (จาก Subject หรือ body)
//   expectedSalary?: number    — เงินเดือนที่ต้องการ
//   experienceText?: string    — ประสบการณ์ทำงาน
//   resumeUrl?: string         — ลิงก์ resume บน JobBKK
//   source?: "JOBBKK"|"JOBTHAI"
// }

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

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : undefined;
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const positionTitle = typeof body.position === "string" ? body.position.trim() : undefined;
  const expectedSalary = typeof body.expectedSalary === "number" ? body.expectedSalary : undefined;
  const experienceText = typeof body.experienceText === "string" ? body.experienceText.trim() : undefined;
  const resumeUrl = typeof body.resumeUrl === "string" ? body.resumeUrl.trim() : undefined;
  const source = body.source === "JOBTHAI" ? "JOBTHAI" as const : "JOBBKK" as const;

  if (!fullName) {
    return NextResponse.json({ error: "fullName is required" }, { status: 400 });
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

  return NextResponse.json({ ok: true, candidateId: candidate.id });
}
