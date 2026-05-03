import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const createJobSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  department: z.string().optional(),
  workType: z.enum(["ONSITE", "WFH", "HYBRID"]).default("ONSITE"),
  salaryMin: z.number().int().positive().optional().nullable(),
  salaryMax: z.number().int().positive().optional().nullable(),
  requiredExperience: z.string().optional(),
  workingTime: z.string().optional(),
  location: z.string().optional(),
  headcount: z.number().int().positive().default(1),
  status: z.enum(["OPEN", "CLOSED", "DRAFT"]).default("OPEN"),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const jobs = await db.jobPosition.findMany({
    where: {
      ...(status && status !== "ALL" ? { status: status as "OPEN" | "CLOSED" | "DRAFT" } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
    },
    include: {
      _count: { select: { candidates: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(jobs);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role === "HR_STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const job = await db.jobPosition.create({
    data: {
      ...parsed.data,
      ownerId: session.user.id,
    },
    include: { _count: { select: { candidates: true } } },
  });

  return NextResponse.json(job, { status: 201 });
}
