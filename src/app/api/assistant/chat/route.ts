import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { runAssistantTurn, type ChatTurn } from "@/lib/assistant/openai";

function deriveTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 50 ? t.slice(0, 50) + "…" : t || "แชทใหม่";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message: string = String(body?.message || "").trim();
  let sessionId: string | undefined = body?.sessionId;
  if (!message) return NextResponse.json({ error: "empty message" }, { status: 400 });

  // resolve or create the session (must belong to this user)
  let chat = sessionId
    ? await prisma.assistantSession.findFirst({ where: { id: sessionId, userId } })
    : null;
  if (!chat) {
    chat = await prisma.assistantSession.create({ data: { userId, title: deriveTitle(message) } });
  }
  sessionId = chat.id;

  // build history from stored messages + the new user turn
  const prior = await prisma.assistantMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });
  const history: ChatTurn[] = [
    ...prior.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  // persist the user message immediately
  await prisma.assistantMessage.create({ data: { sessionId, role: "user", content: message } });

  let reply = "";
  let usage = { promptTokens: 0, outputTokens: 0 };
  try {
    const turn = await runAssistantTurn(history);
    reply = turn.text || "ขออภัย ไม่สามารถสร้างคำตอบได้";
    usage = turn.usage;
  } catch (e: any) {
    if (e.message === "NO_API_KEY") {
      reply = "ยังไม่ได้ตั้งค่า OpenAI API key — โปรดตั้งค่าใน Setting (openai.api_key) หรือ env OPENAI_API_KEY";
    } else {
      console.error("[assistant chat]", e);
      reply = "เกิดข้อผิดพลาดในการเชื่อมต่อ AI โปรดลองใหม่อีกครั้ง";
    }
  }

  // persist the assistant reply + bump session, log usage
  await prisma.assistantMessage.create({ data: { sessionId, role: "assistant", content: reply } });
  await prisma.assistantSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
  await prisma.aiLog.create({
    data: {
      action: "assistant", model: null,
      promptTokens: usage.promptTokens, outputTokens: usage.outputTokens,
      totalTokens: usage.promptTokens + usage.outputTokens, success: true,
    },
  }).catch(() => { /* logging is best-effort */ });

  return NextResponse.json({ sessionId, reply });
}
