import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InterviewType, InterviewStatus } from "@prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  interviewDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  interviewType: z.nativeEnum(InterviewType).optional(),
  interviewerId: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  meetingLink: z.string().nullable().optional(),
  status: z.nativeEnum(InterviewStatus).optional(),
  note: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const interview = await db.interview.findUnique({
    where: { id },
    include: {
      candidate: { select: { id: true, fullName: true, nickname: true } },
      jobPosition: { select: { id: true, title: true } },
      interviewer: { select: { id: true, name: true } },
      feedback: { include: { submittedBy: { select: { id: true, name: true } } } },
    },
  });

  if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(interview);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const updated = await db.interview.update({
    where: { id },
    data: {
      ...(data.interviewDate && { interviewDate: new Date(data.interviewDate) }),
      ...(data.startTime !== undefined && { startTime: data.startTime }),
      ...(data.endTime !== undefined && { endTime: data.endTime }),
      ...(data.interviewType !== undefined && { interviewType: data.interviewType }),
      ...(data.interviewerId !== undefined && { interviewerId: data.interviewerId }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.meetingLink !== undefined && { meetingLink: data.meetingLink }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.note !== undefined && { note: data.note }),
    },
    include: {
      interviewer: { select: { id: true, name: true } },
      feedback: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.interview.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
