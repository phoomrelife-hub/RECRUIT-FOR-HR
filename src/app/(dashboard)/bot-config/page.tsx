import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Bot } from "lucide-react";
import BotConfigClient from "./bot-config-client";

export default async function BotConfigPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canEdit = ["SUPER_ADMIN", "HR_MANAGER"].includes(session.user.role);

  const settings = await db.setting.findMany({
    where: { key: { startsWith: "bot." } },
  });

  const initialConfig: Record<string, string> = {};
  for (const s of settings) {
    initialConfig[s.key.replace("bot.", "")] = s.value;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Bot Configuration</h1>
          </div>
          <p className="text-slate-500 mt-1">ปรับแต่งบุคลิก, Prompt, และพฤติกรรมของ Daniel HR Bot</p>
        </div>
      </div>

      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          คุณมีสิทธิ์ดูเท่านั้น — HR Manager ขึ้นไปสามารถแก้ไขได้
        </div>
      )}

      <BotConfigClient initialConfig={initialConfig} canEdit={canEdit} />
    </div>
  );
}
