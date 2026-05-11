import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const createCandidateSchema = z.object({
  nickname: z.string().optional().nullable(),
  fullName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  age: z.number().int().positive().optional().nullable(),
  sourceChannel: z.enum(["LINE", "FACEBOOK", "MANUAL", "OTHER"]).default("MANUAL"),
  interestedPositionId: z.string().optional().nullable(),
  experienceStatus: z.enum(["EXPERIENCED", "FRESH_GRADUATE", "NO_EXPERIENCE"]).optional().nullable(),
  experienceDetail: z.string().optional().nullable(),
  expectedSalary: z.number().int().positive().optional().nullable(),
  availableStartDate: z.string().optional().nullable(),
  workPreference: z.enum(["ONSITE", "WFH", "HYBRID"]).optional().nullable(),
  hasComputer: z.boolean().optional().nullable(),
  hasInternet: z.boolean().optional().nullable(),
  resumeUrl: z.string().url().optional().nullable(),
  portfolioUrl: z.string().url().optional().nullable(),
  currentStatus: z.enum([
    "NEW_APPLICANT", "BOT_SCREENING", "WAITING_HR_REVIEW", "NEED_MORE_INFO",
    "QUALIFIED", "INTERVIEW_SCHEDULED", "INTERVIEWED", "PASSED", "REJECTED",
    "TALENT_POOL", "CLOSED",
  ]).default("NEW_APPLICANT"),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const search = searchParams.get("search");
  const jobId = searchParams.get("jobId");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const skip = (page - 1) * limit;

  const where = {
    ...(status && status !== "ALL" ? { currentStatus: status as any } : {}),
    ...(source && source !== "ALL" ? { sourceChannel: source as any } : {}),
    ...(jobId ? { interestedPositionId: jobId } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" as const } },
            { nickname: { contains: search, mode: "insensitive" as const } },
            { lineDisplayName: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [candidates, total] = await Promise.all([
    db.candidate.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        nickname: true,
        phone: true,
        email: true,
        age: true,
        sourceChannel: true,
        currentStatus: true,
        interestedPositionId: true,
        interestedPosition: { select: { id: true, title: true } },
        experienceStatus: true,
        expectedSalary: true,
        createdAt: true,
        lineProfilePicUrl: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.candidate.count({ where }),
  ]);

  return NextResponse.json({ candidates, total, page, limit });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const bypass = new URL(req.url).searchParams.get("bypass") === "true";

  // Duplicate check by phone or email
  if (!bypass && (data.phone || data.email)) {
    const orConditions = [];
    if (data.phone) orConditions.push({ phone: data.phone });
    if (data.email) orConditions.push({ email: data.email });
    const existing = await db.candidate.findFirst({
      where: { OR: orConditions },
      select: { id: true, fullName: true, nickname: true, phone: true, email: true, currentStatus: true },
    });
    if (existing) {
      return NextResponse.json({ error: "duplicate", candidate: existing }, { status: 409 });
    }
  }

  const candidate = await db.candidate.create({
    data: {
      ...data,
      availableStartDate: data.availableStartDate ? new Date(data.availableStartDate) : null,
      ownerId: session.user.id,
    },
  });

  await db.candidateStatusHistory.create({
    data: {
      candidateId: candidate.id,
      toStatus: candidate.currentStatus,
      changedById: session.user.id,
      reason: "Manual entry",
    },
  });

  return NextResponse.json(candidate, { status: 201 });
}
