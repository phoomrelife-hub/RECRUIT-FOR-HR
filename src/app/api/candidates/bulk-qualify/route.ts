import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pushMessage } from "@/lib/line";
import { NextResponse } from "next/server";
import type { CandidateStatus } from "@prisma/client";
import {
  DEFAULT_MSG_PASS,
  DEFAULT_MSG_FAIL,
} from "@/app/api/settings/qualify-messages/route";

// POST /api/candidates/bulk-qualify
// Body: { ids: string[], result: "pass" | "fail" }

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  const result = body.result as string;

  if (!ids.length) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }
  if (!["pass", "fail"].includes(result)) {
    return NextResponse.json({ error: 'result must be "pass" or "fail"' }, { status: 400 });
  }

  // ── Read custom messages from settings ───────────────────────────────────
  const settingsRows = await db.setting.findMany({
    where: { key: { in: ["qualify.msg_pass", "qualify.msg_fail"] } },
    select: { key: true, value: true },
  });
  const sm = Object.fromEntries(settingsRows.map((s) => [s.key, s.value]));
  const MSG_PASS = sm["qualify.msg_pass"] || DEFAULT_MSG_PASS;
  const MSG_FAIL = sm["qualify.msg_fail"] || DEFAULT_MSG_FAIL;

  const isPass = result === "pass";
  const newStatus: CandidateStatus = isPass ? "QUALIFIED" : "REJECTED";
  const messageText = isPass ? MSG_PASS : MSG_FAIL;
  const userId = (session.user as { id?: string })?.id ?? "";

  // ── Process each candidate ───────────────────────────────────────────────
  const outcomes = await Promise.allSettled(
    ids.map((id) => processOne(id, isPass, newStatus, messageText, userId))
  );

  const succeeded = outcomes.filter((o) => o.status === "fulfilled").length;
  const failed    = outcomes.filter((o) => o.status === "rejected").length;

  return NextResponse.json({ ok: true, succeeded, failed, total: ids.length });
}

async function processOne(
  id: string,
  isPass: boolean,
  newStatus: CandidateStatus,
  messageText: string,
  userId: string
) {
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) throw new Error(`Not found: ${id}`);

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
        changedById: userId || undefined,
        reason: `Bulk qualify decision by HR: ${isPass ? "✅ ผ่าน" : "❌ ไม่ผ่าน"}`,
      },
    });
  }

  // Save message to inbox
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
      senderId: userId || undefined,
      createdAt: new Date(),
    },
  });
  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), status: "ACTIVE" },
  });

  // Send LINE push
  if (candidate.lineUserId) {
    try {
      await pushMessage(candidate.lineUserId, messageText);
    } catch {
      // non-critical — don't fail the whole batch
    }
  }

  // Patch Notion if available
  if (candidate.notionPageId && process.env.NOTION_TOKEN) {
    try {
      await fetch(`https://api.notion.com/v1/pages/${candidate.notionPageId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          properties: {
            Qualify: { select: { name: isPass ? "✅ ผ่าน" : "❌ ไม่ผ่าน" } },
            "ส่งแจ้งผลแล้ว": { checkbox: true },
          },
        }),
      });
    } catch {
      // non-critical
    }
  }
}
