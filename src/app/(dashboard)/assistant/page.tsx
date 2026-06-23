import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { AssistantClient } from "./assistant-client";

export default async function AssistantPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const sessions = userId
    ? await prisma.assistantSession.findMany({
        where: { userId },
        select: { id: true, title: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
      })
    : [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Assistant</h1>
        <p className="text-sm text-slate-500">ผู้ช่วยค้นหาผู้สมัครที่ตรงสเปก — บอกความต้องการ แล้วให้ AI หาและจัดอันดับให้</p>
      </div>
      <AssistantClient initialSessions={sessions.map((s) => ({ ...s, updatedAt: s.updatedAt.toISOString() }))} />
    </div>
  );
}
