import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pushMessage } from "@/lib/line";
import { NextResponse } from "next/server";
import { parseTier, type Tier } from "@/lib/experience-tier";
import type { CandidateStatus } from "@prisma/client";
import { DEFAULT_MSG_PASS, DEFAULT_MSG_FAIL } from "@/app/api/settings/qualify-messages/route";

// POST /api/candidates/auto-qualify
// Body: { dryRun: boolean }
// Reads autoqual settings, evaluates each queued candidate, optionally processes them

const QUEUE_STATUSES: CandidateStatus[] = [
  "WAITING_HR_REVIEW", "BOT_SCREENING", "NEW_APPLICANT", "NEED_MORE_INFO",
];

type ResultEntry = {
  id: string;
  name: string;
  tier: Tier;
  reason: string;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const dryRun: boolean = body.dryRun !== false; // default to dry run for safety

  // ── Load settings ──────────────────────────────────────────────────────────
  const [settingRows, msgRows] = await Promise.all([
    db.setting.findMany({
      where: { key: { in: ["autoqual.exp_pass_tiers", "autoqual.salary_max", "autoqual.sales_min"] } },
    }),
    db.setting.findMany({
      where: { key: { in: ["qualify.msg_pass", "qualify.msg_fail"] } },
    }),
  ]);

  const sm  = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));
  const msg = Object.fromEntries(msgRows.map((r) => [r.key, r.value]));

  const expPassTiers: Tier[] = sm["autoqual.exp_pass_tiers"]
    ? (sm["autoqual.exp_pass_tiers"].split(",").filter(Boolean) as Tier[])
    : [];
  const salaryMax = sm["autoqual.salary_max"] ? parseInt(sm["autoqual.salary_max"]) : null;
  const salesMin  = sm["autoqual.sales_min"]  ? parseInt(sm["autoqual.sales_min"])  : null;

  const noRulesSet = expPassTiers.length === 0 && salaryMax == null && salesMin == null;
  if (noRulesSet) {
    return NextResponse.json({ error: "กรุณาตั้งกฎ Auto-Qualify ก่อน" }, { status: 400 });
  }

  const MSG_PASS = msg["qualify.msg_pass"] || DEFAULT_MSG_PASS;
  const MSG_FAIL = msg["qualify.msg_fail"] || DEFAULT_MSG_FAIL;

  // ── Load candidates ────────────────────────────────────────────────────────
  const candidates = await db.candidate.findMany({
    where: { currentStatus: { in: QUEUE_STATUSES } },
    select: {
      id: true,
      fullName: true, nickname: true, lineDisplayName: true, lineUserId: true,
      currentStatus: true, experienceText: true,
      expectedSalary: true, maxSalesAmount: true,
      notionPageId: true,
    },
  });

  // ── Evaluate each candidate ────────────────────────────────────────────────
  const autoQualify: ResultEntry[] = [];
  const autoReject:  ResultEntry[] = [];
  const hrReview:    ResultEntry[] = [];

  for (const c of candidates) {
    const name = c.fullName ?? c.nickname ?? c.lineDisplayName ?? "ไม่ระบุ";
    const tier = parseTier(c.experienceText);
    const reasons: string[] = [];
    let verdict: "qualify" | "reject" | "review" = "review";

    // ── Experience tier rule ──────────────────────────────────────────────
    if (expPassTiers.length > 0) {
      if (expPassTiers.includes(tier)) {
        // passes experience rule — continue checking others
      } else {
        verdict = "reject";
        reasons.push(`ประสบการณ์: ${tier}`);
      }
    }

    // ── Salary rule ────────────────────────────────────────────────────────
    if (verdict !== "reject" && salaryMax != null) {
      if (c.expectedSalary != null) {
        if (c.expectedSalary > salaryMax) {
          verdict = "reject";
          reasons.push(`เงินเดือนที่ต้องการ ${c.expectedSalary.toLocaleString()} > ${salaryMax.toLocaleString()}`);
        }
      }
      // if expectedSalary is null → skip (no data, let HR decide)
    }

    // ── Max sales rule ─────────────────────────────────────────────────────
    if (verdict !== "reject" && salesMin != null) {
      if (c.maxSalesAmount != null) {
        if (c.maxSalesAmount < salesMin) {
          verdict = "reject";
          reasons.push(`ยอดขาย ${c.maxSalesAmount.toLocaleString()} < ${salesMin.toLocaleString()}`);
        }
      }
      // if maxSalesAmount is null → skip
    }

    // ── Final verdict ──────────────────────────────────────────────────────
    if (verdict === "reject") {
      autoReject.push({ id: c.id, name, tier, reason: reasons.join(", ") });
    } else if (expPassTiers.includes(tier)) {
      // all rules passed and exp tier is in pass list → auto-qualify
      autoQualify.push({ id: c.id, name, tier, reason: "ผ่านทุกเกณฑ์" });
    } else {
      // exp tier not in pass list and no rules triggered → HR review
      hrReview.push({ id: c.id, name, tier, reason: "ข้อมูลไม่ครบหรืออยู่นอกเกณฑ์" });
    }
  }

  // ── If dry run, return preview only ───────────────────────────────────────
  if (dryRun) {
    return NextResponse.json({ dryRun: true, autoQualify, autoReject, hrReview });
  }

  // ── Run actual processing ──────────────────────────────────────────────────
  const userId = (session.user as { id?: string })?.id ?? "";
  let qualifyDone = 0;
  let rejectDone  = 0;

  await Promise.allSettled([
    ...autoQualify.map((e) => processOne(e.id, true,  "QUALIFIED", MSG_PASS, userId)),
    ...autoReject.map((e)  => processOne(e.id, false, "REJECTED",  MSG_FAIL, userId)),
  ]).then((results) => {
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        if (i < autoQualify.length) qualifyDone++;
        else rejectDone++;
      }
    });
  });

  return NextResponse.json({
    dryRun: false,
    qualifyDone,
    rejectDone,
    hrReview: hrReview.length,
  });
}

async function processOne(
  id: string,
  isPass: boolean,
  newStatus: CandidateStatus,
  messageText: string,
  userId: string,
) {
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) return;

  const prevStatus = candidate.currentStatus;
  await db.candidate.update({ where: { id }, data: { currentStatus: newStatus } });
  await db.candidateStatusHistory.create({
    data: {
      candidateId: id,
      fromStatus: prevStatus,
      toStatus: newStatus,
      changedById: userId || undefined,
      reason: `Auto-qualify: ${isPass ? "✅ ผ่าน" : "❌ ไม่ผ่าน"}`,
    },
  });

  // Save message to inbox
  let conv = await db.conversation.findFirst({
    where: { candidateId: id, status: { not: "CLOSED" } },
    orderBy: { createdAt: "desc" },
  });
  if (!conv) conv = await db.conversation.create({ data: { candidateId: id, channel: "LINE" } });
  await db.message.create({
    data: { conversationId: conv.id, content: messageText, senderType: "HR", senderId: userId || undefined },
  });
  await db.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date(), status: "ACTIVE" } });

  // LINE push
  if (candidate.lineUserId) {
    try { await pushMessage(candidate.lineUserId, messageText); } catch { /* non-critical */ }
  }

  // Notion patch
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
    } catch { /* non-critical */ }
  }
}
