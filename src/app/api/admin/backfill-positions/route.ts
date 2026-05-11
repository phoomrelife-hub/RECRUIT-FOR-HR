import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  fuzzyMatchPosition,
  extractPositionFromMessage,
  findPositionInText,
} from "@/lib/position-match";

// ── POST /api/admin/backfill-positions ────────────────────────────────────────
// Finds candidates without interestedPositionId, extracts position from their
// messages (SYSTEM "ตำแหน่ง: XXX" first, then CANDIDATE free-text), and updates.
//
// Body: { dryRun?: boolean, allStatuses?: boolean }
//   dryRun=true      → preview only, no DB writes
//   allStatuses=true → scan ALL candidates (not just queue statuses)

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let dryRun = false;
  let allStatuses = false;
  try {
    const body = await req.json().catch(() => ({}));
    dryRun = body.dryRun === true;
    allStatuses = body.allStatuses === true;
  } catch { /* ignore */ }

  // ── Fetch candidates without position ─────────────────────────────────────
  const candidates = await db.candidate.findMany({
    where: {
      interestedPositionId: null,
      ...(allStatuses ? {} : {
        currentStatus: {
          in: ["WAITING_HR_REVIEW", "BOT_SCREENING", "NEED_MORE_INFO", "NEW_APPLICANT"],
        },
      }),
    },
    select: {
      id: true,
      nickname: true,
      fullName: true,
      currentStatus: true,
    },
  });

  // ── Fetch messages separately (Prisma nested select with dynamic where is tricky) ─
  const candidateIds = candidates.map((c) => c.id);
  const messages = await db.message.findMany({
    where: {
      conversation: { candidateId: { in: candidateIds } },
      senderType: { in: ["SYSTEM", "CANDIDATE"] },
    },
    select: {
      content: true,
      senderType: true,
      conversation: { select: { candidateId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group messages by candidateId
  const msgMap = new Map<string, { content: string; senderType: string }[]>();
  for (const msg of messages) {
    const cid = msg.conversation.candidateId;
    if (!msgMap.has(cid)) msgMap.set(cid, []);
    msgMap.get(cid)!.push({ content: msg.content, senderType: msg.senderType });
  }

  // ── Fetch all active job positions ────────────────────────────────────────
  const positions = await db.jobPosition.findMany({
    where: { status: { in: ["OPEN", "DRAFT"] } },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });

  const results: {
    candidateId: string;
    name: string;
    status: string;
    source: "system_message" | "candidate_message" | null;
    extractedHint: string;
    matchedPosition: string | null;
    updated: boolean;
  }[] = [];

  for (const candidate of candidates) {
    const allMessages = msgMap.get(candidate.id) ?? [];
    const name = candidate.fullName ?? candidate.nickname ?? candidate.id;

    // ── Pass 1: SYSTEM messages with "ตำแหน่ง: XXX" ──────────────────────
    let matched = undefined as ReturnType<typeof fuzzyMatchPosition>;
    let source: "system_message" | "candidate_message" | null = null;
    let hint = "";

    const systemMsgs = allMessages.filter((m) => m.senderType === "SYSTEM");
    for (const msg of systemMsgs) {
      const extracted = extractPositionFromMessage(msg.content);
      if (extracted) {
        matched = fuzzyMatchPosition(extracted, positions);
        if (matched) { source = "system_message"; hint = extracted; break; }
      }
    }

    // ── Pass 2: CANDIDATE messages — search for position in free text ──────
    if (!matched) {
      const candidateMsgs = allMessages.filter((m) => m.senderType === "CANDIDATE");
      for (const msg of candidateMsgs) {
        const found = findPositionInText(msg.content, positions);
        if (found) {
          matched = found;
          source = "candidate_message";
          hint = msg.content.substring(0, 60);
          break;
        }
      }
    }

    if (!matched) continue;

    if (!dryRun) {
      await db.candidate.update({
        where: { id: candidate.id },
        data: { interestedPositionId: matched.id },
      });
    }

    results.push({
      candidateId: candidate.id,
      name,
      status: candidate.currentStatus,
      source,
      extractedHint: hint,
      matchedPosition: matched.title,
      updated: !dryRun,
    });
  }

  const fixed = results.length;
  const noHint = candidates.length - results.length;
  const bySource = {
    system: results.filter((r) => r.source === "system_message").length,
    candidate: results.filter((r) => r.source === "candidate_message").length,
  };

  return NextResponse.json({
    dryRun,
    allStatuses,
    scanned: candidates.length,
    fixed,
    noHint,
    bySource,
    details: results,
  });
}
