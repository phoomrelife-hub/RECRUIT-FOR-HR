import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getPlatformBotSwitches } from "@/lib/bot-switch";
import IntegrationsClient from "./integrations-client";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  // Webhooks are always hit by external services (LINE/Meta) on the public
  // production host — never on the local auth domain. Use the public app URL,
  // not NEXTAUTH_URL (which is localhost during dev).
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://recruit-for-hr-product.up.railway.app";
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

  const botSwitches = await getPlatformBotSwitches();

  const has = (k: string) => settings.some((s) => s.key === k);
  const isLineConfigured     = has("line.channel_secret") && has("line.channel_access_token");
  const isFacebookConfigured = has("facebook.page_access_token") && has("facebook.app_secret") && has("facebook.verify_token");

  return (
    <IntegrationsClient
      webhookUrl={lineWebhookUrl}
      isLineConfigured={isLineConfigured}
      facebookWebhookUrl={facebookWebhookUrl}
      isFacebookConfigured={isFacebookConfigured}
      botSwitches={botSwitches}
    />
  );
}
