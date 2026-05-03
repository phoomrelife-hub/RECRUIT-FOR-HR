import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AiConfigClient } from "./ai-config-client";
import { Brain } from "lucide-react";

export default async function AiConfigPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "HR_STAFF") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Brain className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">AI Config</h1>
          <p className="text-slate-500 text-sm">ปรับแต่ง AI Bot, Model, และ Behavior ทั้งหมดของระบบ</p>
        </div>
      </div>

      <AiConfigClient />
    </div>
  );
}
