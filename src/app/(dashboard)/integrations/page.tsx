import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import IntegrationsClient from "./integrations-client";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const syncUrl = `${baseUrl}/api/openclaw/sync`;

  const settings = await db.setting.findMany({
    where: {
      key: { in: ["line.channel_secret", "line.channel_access_token", "openclaw.line_webhook_url"] },
    },
  });

  const isLineConfigured = settings.filter((s) =>
    ["line.channel_secret", "line.channel_access_token"].includes(s.key)
  ).length === 2;

  const openclawLineWebhook =
    settings.find((s) => s.key === "openclaw.line_webhook_url")?.value ?? "";

  const telegramConfigured = !!(
    process.env.TELEGRAM_BOT_TOKEN &&
    process.env.TELEGRAM_GROUP_ID &&
    process.env.TELEGRAM_TOPIC_ID
  );

  return (
    <IntegrationsClient
      syncUrl={syncUrl}
      isLineConfigured={isLineConfigured}
      openclawLineWebhook={openclawLineWebhook}
      syncSecret={process.env.OPENCLAW_SYNC_SECRET ? "set" : ""}
      telegramConfigured={telegramConfigured}
    />
  );
}
