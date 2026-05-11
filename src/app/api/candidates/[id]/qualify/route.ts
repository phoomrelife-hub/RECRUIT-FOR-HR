import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pushMessage } from "@/lib/line";
import { sendEmail, renderEmailTemplate } from "@/lib/gmail";
import { NextResponse } from "next/server";
import {
  DEFAULT_MSG_PASS,
  DEFAULT_MSG_FAIL,
} from "@/app/api/settings/qualify-messages/route";
import {
  DEFAULT_EMAIL_QUALIFY,
  EMAIL_QUALIFY_KEYS,
} from "@/app/api/settings/email-qualify/route";

const EMAIL_SOURCES = ["JOBBKK", "JOBTHAI"] as const;
type EmailSource = typeof EMAIL_SOURCES[number];

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

  // ── Detect if email-based candidate ──────────────────────────────────────
  const isEmailSource = EMAIL_SOURCES.includes(candidate.sourceChannel as EmailSource);

  // ── Read custom messages from settings ───────────────────────────────────
  const allKeys = [
    "qualify.msg_pass", "qualify.msg_fail",
    ...Object.values(EMAIL_QUALIFY_KEYS),
  ];
  const settingsRows = await db.setting.findMany({
    where: { key: { in: allKeys } },
    select: { key: true, value: true },
  });
  const sm = Object.fromEntries(settingsRows.map((s) => [s.key, s.value]));
  const MSG_PASS = sm["qualify.msg_pass"] || DEFAULT_MSG_PASS;
  const MSG_FAIL = sm["qualify.msg_fail"] || DEFAULT_MSG_FAIL;

  // Email templates
  const emailSubjectPass = sm[EMAIL_QUALIFY_KEYS.subjectPass] || DEFAULT_EMAIL_QUALIFY.subjectPass;
  const emailSubjectFail = sm[EMAIL_QUALIFY_KEYS.subjectFail] || DEFAULT_EMAIL_QUALIFY.subjectFail;
  const emailBodyPass = sm[EMAIL_QUALIFY_KEYS.bodyPass] || DEFAULT_EMAIL_QUALIFY.bodyPass;
  const emailBodyFail = sm[EMAIL_QUALIFY_KEYS.bodyFail] || DEFAULT_EMAIL_QUALIFY.bodyFail;

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

  // ── send LINE push (LINE candidates) ─────────────────────────────────────
  let lineSent = false;
  let lineError: string | null = null;
  if (!isEmailSource && candidate.lineUserId) {
    try {
      await pushMessage(candidate.lineUserId, messageText);
      lineSent = true;
    } catch (err) {
      lineError = err instanceof Error ? err.message : String(err);
      console.error("[qualify] LINE push failed:", lineError);
    }
  }

  // ── send Email (JobBKK/JobThai candidates) ────────────────────────────────
  let emailSent = false;
  let emailError: string | null = null;
  if (isEmailSource && candidate.email) {
    try {
      const positionTitle = candidate.interestedPositionId
        ? (await db.jobPosition.findUnique({
            where: { id: candidate.interestedPositionId },
            select: { title: true },
          }))?.title ?? ""
        : "";

      const vars = {
        ชื่อ: candidate.fullName ?? candidate.nickname ?? "ผู้สมัคร",
        ตำแหน่ง: positionTitle,
      };

      await sendEmail({
        to: candidate.email,
        subject: renderEmailTemplate(isPass ? emailSubjectPass : emailSubjectFail, vars),
        html: renderEmailTemplate(isPass ? emailBodyPass : emailBodyFail, vars),
      });
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
      console.error("[qualify] Email send failed:", emailError);
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
    emailSent,
    notionPatched,
    ...(lineError ? { lineError } : {}),
    ...(emailError ? { emailError } : {}),
  });
}
