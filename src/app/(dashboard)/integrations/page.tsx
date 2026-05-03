import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import IntegrationsClient from "./integrations-client";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const webhookUrl = `${baseUrl}/api/webhooks/line`;

  const settings = await db.setting.findMany({
    where: { key: { in: ["line.channel_secret", "line.channel_access_token"] } },
  });
  const isLineConfigured = settings.length === 2;

  return (
    <IntegrationsClient
      webhookUrl={webhookUrl}
      isLineConfigured={isLineConfigured}
    />
  );
}
