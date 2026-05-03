import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { TagsClient } from "./tags-client";

export default async function TagsPage() {
  const session = await auth();
  if (!session?.user || session.user.role === "HR_STAFF") redirect("/dashboard");

  const tags = await db.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { candidates: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tags</h1>
        <p className="mt-1 text-sm text-slate-500">จัดการ tags สำหรับ candidates</p>
      </div>
      <TagsClient tags={tags} />
    </div>
  );
}
