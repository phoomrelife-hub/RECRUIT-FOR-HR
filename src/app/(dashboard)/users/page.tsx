import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Users & Roles</h1>
        <p className="mt-1 text-sm text-slate-500">จัดการผู้ใช้งานและสิทธิ์ในระบบ</p>
      </div>
      <UsersClient initialUsers={users} currentUserId={session.user.id} />
    </div>
  );
}
