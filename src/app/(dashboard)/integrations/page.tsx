import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import IntegrationsClient from "./integrations-client";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const lineWebhookUrl     = `${baseUrl}/api/webhooks/line`;
  const facebookWebhookUrl = `${baseUrl}/api/webhooks/facebook`;

  const settings = await db.setting.findMany({
    where: {
      key: {
        in: [
          "line.channel_secret",
          "line.channel_access_token",
          "facebook.page_access_token",
          "facebook.app_secret",
          "facebook.verify_token",
        ],
      },
    },
  });

  const has = (k: string) => settings.some((s) => s.key === k);
  const isLineConfigured     = has("line.channel_secret") && has("line.channel_access_token");
  const isFacebookConfigured = has("facebook.page_access_token") && has("facebook.app_secret") && has("facebook.verify_token");

  return (
    <IntegrationsClient
      webhookUrl={lineWebhookUrl}
      isLineConfigured={isLineConfigured}
      facebookWebhookUrl={facebookWebhookUrl}
      isFacebookConfigured={isFacebookConfigured}
    />
  );
}
