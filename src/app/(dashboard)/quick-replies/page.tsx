import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { QuickRepliesClient } from "./quick-replies-client";

export default async function QuickRepliesPage() {
  const session = await auth();
  if (!session?.user || session.user.role === "HR_STAFF") redirect("/dashboard");

  const quickReplies = await db.quickReply.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quick Replies</h1>
        <p className="mt-1 text-sm text-slate-500">
          ข้อความสำเร็จรูปสำหรับหน้าแชท — 4 อันแรกจะแสดงเป็นปุ่มเหนือช่องพิมพ์
        </p>
      </div>
      <QuickRepliesClient quickReplies={quickReplies} />
    </div>
  );
}
