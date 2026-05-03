import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await db.setting.findMany({
    where: { key: { in: ["openclaw.line_webhook_url"] } },
  });

  const config: Record<string, string> = {};
  for (const s of settings) config[s.key.replace("openclaw.", "")] = s.value;

  return NextResponse.json(config);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { lineWebhookUrl } = await req.json();

  await db.setting.upsert({
    where: { key: "openclaw.line_webhook_url" },
    update: { value: lineWebhookUrl ?? "" },
    create: { key: "openclaw.line_webhook_url", value: lineWebhookUrl ?? "" },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.setting.deleteMany({
    where: { key: { in: ["openclaw.line_webhook_url"] } },
  });

  return NextResponse.json({ ok: true });
}
