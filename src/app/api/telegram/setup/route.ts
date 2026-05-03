import { auth } from "@/lib/auth";
import { setTelegramWebhook, getTelegramWebhookInfo } from "@/lib/telegram";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const info = await getTelegramWebhookInfo();
  return NextResponse.json(info ?? { url: "", pending: 0 });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  const ok = await setTelegramWebhook(webhookUrl);
  return NextResponse.json({ ok, webhookUrl });
}
