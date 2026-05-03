import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const summary = await db.aiSummary.findUnique({ where: { candidateId: id } });
  return NextResponse.json(summary);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const candidate = await db.candidate.findUnique({
    where: { id },
    include: {
      interestedPosition: { select: { title: true, department: true, requiredExperience: true, salaryMin: true, salaryMax: true } },
      screeningAnswers: { include: { screeningQuestion: { select: { question: true } } } },
      candidateScore: true,
      notes: { include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parts: string[] = [];

  parts.push(`# ข้อมูลผู้สมัคร`);
  parts.push(`ชื่อ: ${candidate.fullName ?? candidate.nickname ?? "ไม่ระบุ"}`);
  if (candidate.age) parts.push(`อายุ: ${candidate.age} ปี`);
  if (candidate.interestedPosition) parts.push(`ตำแหน่งที่สมัคร: ${candidate.interestedPosition.title}${candidate.interestedPosition.department ? ` (${candidate.interestedPosition.department})` : ""}`);
  if (candidate.experienceStatus) parts.push(`ประสบการณ์: ${candidate.experienceStatus}`);
  if (candidate.experienceDetail) parts.push(`รายละเอียดประสบการณ์: ${candidate.experienceDetail}`);
  if (candidate.expectedSalary) parts.push(`เงินเดือนที่ต้องการ: ${candidate.expectedSalary.toLocaleString()} บาท`);
  if (candidate.interestedPosition?.salaryMin) {
    parts.push(`เงินเดือนที่บริษัทกำหนด: ${candidate.interestedPosition.salaryMin.toLocaleString()} - ${candidate.interestedPosition.salaryMax?.toLocaleString() ?? "?"} บาท`);
  }
  if (candidate.workPreference) parts.push(`รูปแบบการทำงานที่ต้องการ: ${candidate.workPreference}`);
  if (candidate.availableStartDate) parts.push(`วันที่พร้อมเริ่มงาน: ${new Date(candidate.availableStartDate).toLocaleDateString("th-TH")}`);
  parts.push(`สถานะปัจจุบัน: ${candidate.currentStatus}`);

  if (candidate.screeningAnswers.length > 0) {
    parts.push(`\n# คำตอบ Screening`);
    for (const a of candidate.screeningAnswers) {
      parts.push(`Q: ${a.screeningQuestion.question}\nA: ${a.answer}`);
    }
  }

  if (candidate.candidateScore) {
    const s = candidate.candidateScore;
    parts.push(`\n# คะแนนการประเมิน (0-10)`);
    parts.push(`- ประสบการณ์: ${s.experience}/10`);
    parts.push(`- การสื่อสาร: ${s.communication}/10`);
    parts.push(`- ความพร้อม: ${s.availability}/10`);
    parts.push(`- ความเหมาะสมด้านเงินเดือน: ${s.salaryFit}/10`);
    parts.push(`- ความเหมาะสมกับตำแหน่ง: ${s.roleFit}/10`);
    parts.push(`- ทัศนคติ: ${s.attitude}/10`);
    parts.push(`- คะแนนรวม: ${s.totalScore}/60`);
  }

  if (candidate.notes.length > 0) {
    parts.push(`\n# Notes จาก HR`);
    for (const n of candidate.notes) {
      parts.push(`[${n.createdBy.name}]: ${n.content}`);
    }
  }

  const prompt = `${parts.join("\n")}

---
คุณเป็น HR Assistant ของ Relife บริษัทขาย Supplement และสินค้าสุขภาพ

จากข้อมูลข้างต้น กรุณาสรุปผู้สมัครคนนี้ในรูปแบบ JSON ดังนี้ (ตอบเป็น JSON เท่านั้น ไม่ต้องมี markdown code block):
{
  "summary": "สรุปภาพรวมผู้สมัคร 2-3 ประโยค",
  "strengths": "จุดเด่น 2-3 ข้อ คั่นด้วย | เช่น มีประสบการณ์ขายตรง | สื่อสารดี",
  "concerns": "ข้อกังวล 1-2 ข้อ คั่นด้วย | หรือ null ถ้าไม่มี",
  "recommendation": "RECOMMEND หรือ CONSIDER หรือ NOT_RECOMMEND",
  "nextAction": "ขั้นตอนต่อไปที่แนะนำ เช่น นัดสัมภาษณ์, ขอข้อมูลเพิ่มเติม"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  let parsed: { summary: string; strengths: string | null; concerns: string | null; recommendation: string | null; nextAction: string | null };
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    parsed = {
      summary: text,
      strengths: null,
      concerns: null,
      recommendation: null,
      nextAction: null,
    };
  }

  const aiSummary = await db.aiSummary.upsert({
    where: { candidateId: id },
    create: {
      candidateId: id,
      summary: parsed.summary,
      strengths: parsed.strengths,
      concerns: parsed.concerns,
      recommendation: parsed.recommendation,
      nextAction: parsed.nextAction,
    },
    update: {
      summary: parsed.summary,
      strengths: parsed.strengths,
      concerns: parsed.concerns,
      recommendation: parsed.recommendation,
      nextAction: parsed.nextAction,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "GENERATE_AI_SUMMARY",
      targetId: id,
      targetType: "Candidate",
    },
  });

  return NextResponse.json(aiSummary);
}
