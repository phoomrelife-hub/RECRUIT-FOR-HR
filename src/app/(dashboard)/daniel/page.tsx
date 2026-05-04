import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DanielDashboardClient from "./daniel-dashboard-client";

export default async function DanielDashboardPage() {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "HR_MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const apiUrl = process.env.OPENCLAW_API_URL || "http://localhost:18789";
  const hasApiKey = !!process.env.OPENCLAW_API_KEY;

  return <DanielDashboardClient apiUrl={apiUrl} hasApiKey={hasApiKey} isSuperAdmin={session.user.role === "SUPER_ADMIN"} />;
}
