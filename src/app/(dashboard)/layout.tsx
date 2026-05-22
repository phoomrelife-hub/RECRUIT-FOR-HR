import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { UserRole } from "@prisma/client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardShell
        userName={session.user.name ?? ""}
        userEmail={session.user.email ?? ""}
        userRole={session.user.role as UserRole}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
