import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateJobSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  workType: z.enum(["ONSITE", "WFH", "HYBRID"]).optional(),
  salaryMin: z.number().int().positive().optional().nullable(),
  salaryMax: z.number().int().positive().optional().nullable(),
  requiredExperience: z.string().optional().nullable(),
  workingTime: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  headcount: z.number().int().positive().optional(),
  status: z.enum(["OPEN", "CLOSED", "DRAFT"]).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await db.jobPosition.findUnique({
    where: { id },
    include: {
      candidates: {
        select: { id: true, fullName: true, nickname: true, currentStatus: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: { select: { candidates: true } },
    },
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(job);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role === "HR_STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const job = await db.jobPosition.update({
    where: { id },
    data: parsed.data,
    include: { _count: { select: { candidates: true } } },
  });

  return NextResponse.json(job);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await db.jobPosition.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
