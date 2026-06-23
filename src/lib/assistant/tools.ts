// Read-only tools for the recruit AI Assistant. All tools auto-run in the loop.
import { db as prisma } from "@/lib/db";
import { parseTier } from "@/lib/experience-tier";
import { getNotionDetail } from "@/lib/notion-detail";
import { getSetting } from "./config";
import type { Prisma, CandidateStatus } from "@prisma/client";

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
}

export const READ_TOOLS = new Set([
  "search_candidates",
  "get_candidate",
  "get_job_position",
  "list_job_positions",
  "get_pipeline_stats",
  "search_messages",
  "get_conversation",
  "get_review_queue",
  "query_records",
]);

// Generic read allowlist — every other (non-credential) table the assistant may read.
// Models holding secrets/credentials are intentionally absent: Setting, AiProvider,
// Account, Session, VerificationToken. User is included but password is never selected.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModelEntry = { delegate: any; select?: Record<string, true>; defaultOrderBy?: unknown };
const QUERY_MODELS: Record<string, ModelEntry> = {
  candidate: { delegate: prisma.candidate, defaultOrderBy: { createdAt: "desc" } },
  job_position: { delegate: prisma.jobPosition, defaultOrderBy: { createdAt: "desc" } },
  interview: { delegate: prisma.interview, defaultOrderBy: { interviewDate: "desc" } },
  interview_feedback: { delegate: prisma.interviewFeedback, defaultOrderBy: { createdAt: "desc" } },
  screening_form: { delegate: prisma.screeningForm },
  screening_question: { delegate: prisma.screeningQuestion },
  screening_answer: { delegate: prisma.screeningAnswer },
  candidate_score: { delegate: prisma.candidateScore },
  ai_summary: { delegate: prisma.aiSummary, defaultOrderBy: { createdAt: "desc" } },
  hiring_decision: { delegate: prisma.hiringDecision, defaultOrderBy: { createdAt: "desc" } },
  tag: { delegate: prisma.tag },
  candidate_tag: { delegate: prisma.candidateTag },
  candidate_note: { delegate: prisma.candidateNote, defaultOrderBy: { createdAt: "desc" } },
  candidate_status_history: { delegate: prisma.candidateStatusHistory, defaultOrderBy: { createdAt: "desc" } },
  candidate_assignment: { delegate: prisma.candidateAssignment, defaultOrderBy: { assignedAt: "desc" } },
  conversation: { delegate: prisma.conversation, defaultOrderBy: { lastMessageAt: "desc" } },
  message: { delegate: prisma.message, defaultOrderBy: { createdAt: "desc" } },
  quick_reply: { delegate: prisma.quickReply },
  user: { delegate: prisma.user, select: { id: true, name: true, email: true, role: true, status: true, createdAt: true } },
  audit_log: { delegate: prisma.auditLog, defaultOrderBy: { createdAt: "desc" } },
  ai_log: { delegate: prisma.aiLog, defaultOrderBy: { createdAt: "desc" } },
};
const QUERY_MODEL_NAMES = Object.keys(QUERY_MODELS);

const MESSAGE_SENDERS = ["CANDIDATE", "BOT", "HR", "SYSTEM"];
const SOURCE_CHANNELS = ["LINE", "FACEBOOK", "WEBSITE", "MANUAL", "JOBBKK", "JOBTHAI", "OTHER"];
// Statuses shown in the /review HR queue (same set as auto-qualify scans).
const REVIEW_QUEUE_STATUSES: CandidateStatus[] = ["WAITING_HR_REVIEW", "BOT_SCREENING", "NEW_APPLICANT", "NEED_MORE_INFO"];

const CANDIDATE_STATUSES = [
  "NEW_APPLICANT", "BOT_SCREENING", "WAITING_HR_REVIEW", "NEED_MORE_INFO",
  "QUALIFIED", "INTERVIEW_SCHEDULED", "INTERVIEWED", "PASSED", "HIRED",
  "REJECTED", "TALENT_POOL", "CLOSED",
];

export const TOOLS: ToolSchema[] = [
  {
    name: "search_candidates",
    description:
      "Search the candidate database with structured filters and return matching candidates (capped). Use this to find people who fit a requirement. Each row includes experienceText and a derived experience tier so you can rank fuzzy fit yourself. All filters optional; omit what is not specified.",
    input_schema: {
      type: "object",
      properties: {
        positionId: { type: "string", description: "JobPosition id to filter interestedPosition by." },
        positionTitle: { type: "string", description: "JobPosition title (substring, case-insensitive) — used if positionId not given." },
        status: { type: "array", items: { type: "string", enum: CANDIDATE_STATUSES }, description: "Filter by current pipeline status." },
        experienceTier: { type: "array", items: { type: "string", enum: ["high", "mid", "low", "unspecified", "none"] }, description: "Derived from experienceText: high=5+yrs, mid=2-4, low=<2, unspecified=mentions exp but no years, none=fresh." },
        experienceStatus: { type: "string", enum: ["EXPERIENCED", "FRESH_GRADUATE", "NO_EXPERIENCE"] },
        expectedSalaryMax: { type: "number", description: "Only candidates whose expectedSalary <= this (THB)." },
        maxSalesMin: { type: "number", description: "Only candidates whose maxSalesAmount >= this (THB/month)." },
        workPreference: { type: "string", enum: ["ONSITE", "WFH", "HYBRID"] },
        hasComputer: { type: "boolean" },
        hasInternet: { type: "boolean" },
        ageMin: { type: "number" },
        ageMax: { type: "number" },
        tagNames: { type: "array", items: { type: "string" }, description: "Candidate must have ALL these tag names." },
        area: { type: "string", description: "Match the candidate's address/district (substring, case-insensitive) — e.g. \"มีนบุรี\", \"ลาดกระบัง\", \"กรุงเทพ\". Use for \"ผู้สมัครในเขตนี้\" questions. Address is backfilled from Notion." },
        keyword: { type: "string", description: "Substring match (case-insensitive) on experienceText, experienceDetail, address, fullName, or nickname." },
        sourceChannel: { type: "string", enum: ["LINE", "FACEBOOK", "WEBSITE", "MANUAL", "JOBBKK", "JOBTHAI", "OTHER"] },
        limit: { type: "number", description: "Max rows (default 25, hard cap 50)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_candidate",
    description: "Fetch full detail for one candidate by id: profile, screening Q&A, score, status history, and deep Notion Q&A if available. Use when the user asks to know more about a specific person.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: "Candidate id." } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_job_position",
    description: "Get one job position's saved requirements (salary range, required experience, work type, headcount, status) by id or title. Use to anchor matching to a real spec.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string", description: "Substring, case-insensitive — used if id not given." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_job_positions",
    description: "List job positions (id, title, status, salary range, headcount). Use to discover what roles exist.",
    input_schema: {
      type: "object",
      properties: { onlyOpen: { type: "boolean", description: "If true, only status=OPEN." } },
      additionalProperties: false,
    },
  },
  {
    name: "get_pipeline_stats",
    description: "Overview counts: candidates per status, today's new applicants, today's scheduled interviews. Use for ภาพรวม-style questions like 'how many new applicants today'.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_review_queue",
    description:
      "Get the HR review queue — candidates awaiting review/qualification (statuses WAITING_HR_REVIEW, BOT_SCREENING, NEW_APPLICANT, NEED_MORE_INFO), the same list shown on the /review page (คิวพิจารณา). Each row includes experience tier, expected salary, max sales, work preference, tags, and experienceText so you can help triage/rank who to qualify. Optionally filter by position. Returns counts per status plus the candidate rows.",
    input_schema: {
      type: "object",
      properties: {
        positionId: { type: "string", description: "Limit to one JobPosition id." },
        positionTitle: { type: "string", description: "JobPosition title (substring, case-insensitive) — used if positionId not given." },
        limit: { type: "number", description: "Max rows, newest first (default 50, hard cap 100)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_messages",
    description:
      "Search across ALL inbox chat messages — every conversation, every channel (LINE/Facebook/etc.), read-only. Use this to find candidates by what they actually said in chat to the bot (หลิน/OpenClaw) or HR — e.g. \"พร้อมเริ่มงานทันที\", \"ทำงานเสาร์อาทิตย์ได้\", \"WFH\", \"เคยขายประกัน\". Returns matching messages with the candidate, channel, sender, and time. Use senderType=CANDIDATE to search only what applicants themselves wrote. Follow up with get_conversation to read the surrounding thread or get_candidate for the profile.",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Substring to find in the message text (case-insensitive). This is the main filter — usually provide it." },
        senderType: { type: "string", enum: MESSAGE_SENDERS, description: "Who sent the message. CANDIDATE = the applicant, BOT = หลิน/OpenClaw, HR = staff, SYSTEM = system notes." },
        channel: { type: "string", enum: SOURCE_CHANNELS, description: "Limit to one chat channel." },
        candidateId: { type: "string", description: "Limit to one candidate's messages." },
        sinceDays: { type: "number", description: "Only messages from the last N days." },
        limit: { type: "number", description: "Max messages, most recent first (default from settings ≈50, hard cap 200)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_conversation",
    description:
      "Read one full chat thread in chronological order (read-only). Pass conversationId, or candidateId to read that candidate's most recent conversation. Use after search_messages to see the context around a match, or to review a candidate's whole conversation with the bot/HR.",
    input_schema: {
      type: "object",
      properties: {
        conversationId: { type: "string", description: "The conversation to read." },
        candidateId: { type: "string", description: "Used if conversationId is not given — reads the candidate's latest conversation." },
        limit: { type: "number", description: "Max messages, most recent kept then shown oldest→newest (default from settings ≈100, hard cap 300)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "query_records",
    description:
      "Generic READ-ONLY query over any HR table not covered by a specific tool — use this so you can read almost anything in the system. Pick a model, an optional Prisma-style `where` filter, optional orderBy, and a limit. Returns rows; credential/secret tables and fields are never exposed (Settings, API keys, passwords, auth tokens are intentionally unavailable). Available models: candidate, job_position, interview, interview_feedback, screening_form, screening_question, screening_answer, candidate_score, ai_summary, hiring_decision, tag, candidate_tag, candidate_note, candidate_status_history, candidate_assignment, conversation, message, quick_reply, user (id/name/email/role/status only), audit_log, ai_log. Field names are camelCase from the Prisma schema. Prefer the specific tools (search_candidates, get_review_queue, etc.) when they fit — they return better-shaped data.",
    input_schema: {
      type: "object",
      properties: {
        model: { type: "string", enum: QUERY_MODEL_NAMES, description: "Which table to read." },
        where: { type: "object", description: "Optional Prisma where filter, e.g. {\"currentStatus\":\"QUALIFIED\"} or {\"interviewDate\":{\"gte\":\"2026-06-01T00:00:00Z\"}} or {\"finalResult\":\"PASSED\"}. Use exact camelCase field names. Invalid filters return an error you can correct.", additionalProperties: true },
        orderBy: { type: "object", description: "Optional sort, e.g. {\"createdAt\":\"desc\"}.", additionalProperties: true },
        limit: { type: "number", description: "Max rows (default 25, hard cap 100)." },
      },
      required: ["model"],
      additionalProperties: false,
    },
  },
];

// ── helpers ──────────────────────────────────────────────────────────────────

function bangkokTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  // shift to Bangkok wall-clock to get y/m/d
  const bkk = new Date(now.getTime() + 7 * 3600 * 1000);
  const y = bkk.getUTCFullYear(), m = bkk.getUTCMonth(), d = bkk.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, -7, 0, 0));
  const end = new Date(Date.UTC(y, m, d + 1, -7, 0, 0));
  return { start, end };
}

function candidateName(c: { nickname: string | null; fullName: string | null; lineDisplayName: string | null }): string {
  return c.fullName || c.nickname || c.lineDisplayName || "(ไม่ระบุชื่อ)";
}

// Shared include + row shape for search_candidates and get_review_queue.
const CANDIDATE_ROW_INCLUDE = {
  interestedPosition: { select: { title: true } },
  tags: { include: { tag: { select: { name: true } } } },
  candidateScore: { select: { totalScore: true } },
} satisfies Prisma.CandidateInclude;

type CandidateRow = Prisma.CandidateGetPayload<{ include: typeof CANDIDATE_ROW_INCLUDE }>;

function mapCandidateRow(c: CandidateRow) {
  return {
    id: c.id,
    name: candidateName(c),
    age: c.age,
    position: c.interestedPosition?.title ?? null,
    status: c.currentStatus,
    tier: parseTier(c.experienceText),
    experienceStatus: c.experienceStatus,
    expectedSalary: c.expectedSalary,
    maxSalesAmount: c.maxSalesAmount,
    workPreference: c.workPreference,
    hasComputer: c.hasComputer,
    address: c.address,
    tags: c.tags.map((t) => t.tag.name),
    experienceText: c.experienceText,
    score: c.candidateScore?.totalScore ?? null,
  };
}

// ── executor ─────────────────────────────────────────────────────────────────

export async function runReadTool(name: string, args: Record<string, any>): Promise<unknown> {
  switch (name) {
    case "search_candidates":
      return searchCandidates(args);
    case "get_candidate":
      return getCandidate(String(args.id || ""));
    case "get_job_position":
      return getJobPosition(args);
    case "list_job_positions":
      return listJobPositions(Boolean(args.onlyOpen));
    case "get_pipeline_stats":
      return getPipelineStats();
    case "search_messages":
      return searchMessages(args);
    case "get_conversation":
      return getConversation(args);
    case "get_review_queue":
      return getReviewQueue(args);
    case "query_records":
      return queryRecords(args);
    default:
      throw new Error(`unknown read tool: ${name}`);
  }
}

async function searchCandidates(args: Record<string, any>) {
  const limit = Math.min(Number(args.limit) || 25, 50);
  const where: Prisma.CandidateWhereInput = {};

  // position
  if (args.positionId) where.interestedPositionId = String(args.positionId);
  else if (args.positionTitle) {
    const pos = await prisma.jobPosition.findFirst({
      where: { title: { contains: String(args.positionTitle), mode: "insensitive" } },
      select: { id: true },
    });
    if (pos) where.interestedPositionId = pos.id;
    else return { count: 0, candidates: [], note: `ไม่พบตำแหน่งงานที่ชื่อใกล้เคียง "${args.positionTitle}"` };
  }

  if (Array.isArray(args.status) && args.status.length) where.currentStatus = { in: args.status };
  if (args.experienceStatus) where.experienceStatus = args.experienceStatus;
  if (typeof args.expectedSalaryMax === "number") where.expectedSalary = { lte: args.expectedSalaryMax };
  if (typeof args.maxSalesMin === "number") where.maxSalesAmount = { gte: args.maxSalesMin };
  if (args.workPreference) where.workPreference = args.workPreference;
  if (typeof args.hasComputer === "boolean") where.hasComputer = args.hasComputer;
  if (typeof args.hasInternet === "boolean") where.hasInternet = args.hasInternet;
  if (typeof args.ageMin === "number" || typeof args.ageMax === "number") {
    where.age = {};
    if (typeof args.ageMin === "number") (where.age as Prisma.IntNullableFilter).gte = args.ageMin;
    if (typeof args.ageMax === "number") (where.age as Prisma.IntNullableFilter).lte = args.ageMax;
  }
  if (args.sourceChannel) where.sourceChannel = args.sourceChannel;
  if (args.area) where.address = { contains: String(args.area), mode: "insensitive" };
  if (Array.isArray(args.tagNames) && args.tagNames.length) {
    where.AND = args.tagNames.map((t: string) => ({ tags: { some: { tag: { name: t } } } }));
  }
  if (args.keyword) {
    const k = String(args.keyword);
    where.OR = [
      { experienceText: { contains: k, mode: "insensitive" } },
      { experienceDetail: { contains: k, mode: "insensitive" } },
      { address: { contains: k, mode: "insensitive" } },
      { fullName: { contains: k, mode: "insensitive" } },
      { nickname: { contains: k, mode: "insensitive" } },
    ];
  }

  // Over-fetch before the derived tier filter, then cap.
  const tierFilter: string[] | null = Array.isArray(args.experienceTier) && args.experienceTier.length ? args.experienceTier : null;
  const rows = await prisma.candidate.findMany({
    where,
    take: tierFilter ? 200 : limit,
    orderBy: { createdAt: "desc" },
    include: CANDIDATE_ROW_INCLUDE,
  });

  let mapped = rows.map(mapCandidateRow);
  if (tierFilter) mapped = mapped.filter((m) => tierFilter.includes(m.tier));
  const capped = mapped.slice(0, limit);
  return { count: capped.length, candidates: capped };
}

async function getCandidate(id: string) {
  if (!id) throw new Error("get_candidate requires an id");
  const c = await prisma.candidate.findUnique({
    where: { id },
    include: {
      interestedPosition: { select: { title: true, salaryMin: true, salaryMax: true, requiredExperience: true } },
      tags: { include: { tag: { select: { name: true } } } },
      candidateScore: true,
      screeningAnswers: { include: { screeningQuestion: { select: { question: true } } } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!c) return { error: "ไม่พบผู้สมัครรายนี้" };

  let notion: unknown = null;
  if (c.notionPageId && process.env.NOTION_TOKEN) {
    try {
      // Live Notion page: full address, properties, and deep Q&A.
      notion = await getNotionDetail(c.notionPageId);
    } catch {
      notion = null; // graceful — DB fields still returned
    }
  }

  return {
    id: c.id,
    name: candidateName(c),
    nickname: c.nickname,
    age: c.age,
    phone: c.phone,
    email: c.email,
    position: c.interestedPosition?.title ?? null,
    positionRequirement: c.interestedPosition
      ? { salaryMin: c.interestedPosition.salaryMin, salaryMax: c.interestedPosition.salaryMax, requiredExperience: c.interestedPosition.requiredExperience }
      : null,
    status: c.currentStatus,
    tier: parseTier(c.experienceText),
    experienceStatus: c.experienceStatus,
    experienceText: c.experienceText,
    experienceDetail: c.experienceDetail,
    expectedSalary: c.expectedSalary,
    maxSalesAmount: c.maxSalesAmount,
    workPreference: c.workPreference,
    hasComputer: c.hasComputer,
    hasInternet: c.hasInternet,
    address: c.address,
    tags: c.tags.map((t) => t.tag.name),
    score: c.candidateScore,
    screening: c.screeningAnswers.map((a) => ({ q: a.screeningQuestion.question, a: a.answer })),
    statusHistory: c.statusHistory.map((h) => ({ to: h.toStatus, from: h.fromStatus, at: h.createdAt })),
    notion,
  };
}

async function getJobPosition(args: Record<string, any>) {
  const where: Prisma.JobPositionWhereInput = args.id
    ? { id: String(args.id) }
    : args.title
      ? { title: { contains: String(args.title), mode: "insensitive" } }
      : {};
  const p = await prisma.jobPosition.findFirst({ where });
  if (!p) return { error: "ไม่พบตำแหน่งงาน" };
  return {
    id: p.id, title: p.title, status: p.status, department: p.department,
    workType: p.workType, salaryMin: p.salaryMin, salaryMax: p.salaryMax,
    requiredExperience: p.requiredExperience, workingTime: p.workingTime,
    location: p.location, headcount: p.headcount, description: p.description,
  };
}

async function listJobPositions(onlyOpen: boolean) {
  const positions = await prisma.jobPosition.findMany({
    where: onlyOpen ? { status: "OPEN" } : {},
    select: { id: true, title: true, status: true, salaryMin: true, salaryMax: true, headcount: true },
    orderBy: { createdAt: "desc" },
  });
  return { count: positions.length, positions };
}

async function getPipelineStats() {
  const { start, end } = bangkokTodayRange();
  const grouped = await prisma.candidate.groupBy({ by: ["currentStatus"], _count: { _all: true } });
  const byStatus: Record<string, number> = {};
  for (const g of grouped) byStatus[g.currentStatus] = g._count._all;
  const [newToday, interviewsToday, total] = await Promise.all([
    prisma.candidate.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.interview.count({ where: { interviewDate: { gte: start, lt: end }, status: "SCHEDULED" } }),
    prisma.candidate.count(),
  ]);
  return { totalCandidates: total, byStatus, newApplicantsToday: newToday, scheduledInterviewsToday: interviewsToday };
}

async function getReviewQueue(args: Record<string, any>) {
  const limit = Math.min(Number(args.limit) || 50, 100);
  const where: Prisma.CandidateWhereInput = { currentStatus: { in: REVIEW_QUEUE_STATUSES } };

  if (args.positionId) where.interestedPositionId = String(args.positionId);
  else if (args.positionTitle) {
    const pos = await prisma.jobPosition.findFirst({
      where: { title: { contains: String(args.positionTitle), mode: "insensitive" } },
      select: { id: true },
    });
    if (pos) where.interestedPositionId = pos.id;
    else return { total: 0, byStatus: {}, returned: 0, candidates: [], note: `ไม่พบตำแหน่งงานที่ชื่อใกล้เคียง "${args.positionTitle}"` };
  }

  const [grouped, rows] = await Promise.all([
    prisma.candidate.groupBy({ by: ["currentStatus"], where, _count: { _all: true } }),
    prisma.candidate.findMany({ where, take: limit, orderBy: { createdAt: "desc" }, include: CANDIDATE_ROW_INCLUDE }),
  ]);
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const g of grouped) { byStatus[g.currentStatus] = g._count._all; total += g._count._all; }

  return { total, byStatus, returned: rows.length, candidates: rows.map(mapCandidateRow) };
}

async function queryRecords(args: Record<string, any>) {
  const key = String(args.model || "");
  const entry = QUERY_MODELS[key];
  if (!entry) {
    return { error: `อ่านตาราง "${key}" ไม่ได้ (ไม่อยู่ใน allowlist หรือเป็นข้อมูลลับ)`, availableModels: QUERY_MODEL_NAMES };
  }
  const limit = Math.min(Number(args.limit) || 25, 100);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: Record<string, any> = { take: limit };
  if (args.where && typeof args.where === "object") q.where = args.where;
  if (args.orderBy && typeof args.orderBy === "object") q.orderBy = args.orderBy;
  else if (entry.defaultOrderBy) q.orderBy = entry.defaultOrderBy;
  if (entry.select) q.select = entry.select;

  try {
    const rows: unknown[] = await entry.delegate.findMany(q);
    return { model: key, count: rows.length, rows };
  } catch (e: any) {
    return { error: `query ล้มเหลว: ${e?.message ? String(e.message).slice(0, 300) : "unknown"} — ตรวจชื่อฟิลด์ใน where/orderBy ให้ตรงสคีมา (camelCase)` };
  }
}

// Resolve a configurable cap from the Setting table, clamped to a hard ceiling.
async function resolveLimit(settingKey: string, fallback: number, hardCap: number, requested?: unknown): Promise<number> {
  const raw = Number(requested);
  if (Number.isFinite(raw) && raw > 0) return Math.min(raw, hardCap);
  const configured = Number(await getSetting(settingKey));
  const base = Number.isFinite(configured) && configured > 0 ? configured : fallback;
  return Math.min(base, hardCap);
}

async function searchMessages(args: Record<string, any>) {
  const limit = await resolveLimit("assistant.msg_search_limit", 50, 200, args.limit);
  const where: Prisma.MessageWhereInput = {};
  if (args.keyword) where.content = { contains: String(args.keyword), mode: "insensitive" };
  if (args.senderType) where.senderType = args.senderType;
  if (typeof args.sinceDays === "number" && args.sinceDays > 0) {
    where.createdAt = { gte: new Date(Date.now() - args.sinceDays * 86400000) };
  }
  const convWhere: Prisma.ConversationWhereInput = {};
  if (args.channel) convWhere.channel = args.channel;
  if (args.candidateId) convWhere.candidateId = String(args.candidateId);
  if (Object.keys(convWhere).length) where.conversation = convWhere;

  const rows = await prisma.message.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      conversation: {
        select: {
          channel: true,
          candidate: { select: { id: true, nickname: true, fullName: true, lineDisplayName: true } },
        },
      },
    },
  });

  return {
    count: rows.length,
    messages: rows.map((m) => ({
      messageId: m.id,
      conversationId: m.conversationId,
      candidateId: m.conversation.candidate.id,
      candidateName: candidateName(m.conversation.candidate),
      channel: m.conversation.channel,
      sender: m.senderType,
      at: m.createdAt,
      text: m.content.slice(0, 600),
    })),
  };
}

async function getConversation(args: Record<string, any>) {
  const limit = await resolveLimit("assistant.conversation_limit", 100, 300, args.limit);
  let conversationId = args.conversationId ? String(args.conversationId) : null;

  if (!conversationId && args.candidateId) {
    const latest = await prisma.conversation.findFirst({
      where: { candidateId: String(args.candidateId) },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    if (!latest) return { error: "ไม่พบบทสนทนาของผู้สมัครรายนี้" };
    conversationId = latest.id;
  }
  if (!conversationId) throw new Error("get_conversation requires conversationId or candidateId");

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { candidate: { select: { id: true, nickname: true, fullName: true, lineDisplayName: true } } },
  });
  if (!conv) return { error: "ไม่พบบทสนทนา" };

  const recent = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { senderType: true, content: true, createdAt: true },
  });
  recent.reverse(); // chronological (oldest → newest)

  return {
    conversationId,
    candidateId: conv.candidate.id,
    candidateName: candidateName(conv.candidate),
    channel: conv.channel,
    messageCount: recent.length,
    messages: recent.map((m) => ({ sender: m.senderType, text: m.content, at: m.createdAt })),
  };
}
