// GET/PUT the global per-platform bot kill switch shown on /integrations.
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  BOT_PLATFORMS,
  getPlatformBotSwitches,
  setPlatformBotEnabled,
  type BotPlatform,
} from "@/lib/bot-switch";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await getPlatformBotSwitches(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { platform?: string; enabled?: unknown }
    | null;

  const platform = body?.platform as BotPlatform | undefined;
  if (!platform || !BOT_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { error: `platform must be one of ${BOT_PLATFORMS.join(", ")}` },
      { status: 400 },
    );
  }
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  await setPlatformBotEnabled(platform, body.enabled);

  // Turning a whole channel on/off is exactly the kind of action someone will
  // later need to explain, so record who did it.
  await db.auditLog
    .create({
      data: {
        userId: session.user.id,
        action: body.enabled ? "RESUME_BOT" : "TAKEOVER_CONVERSATION",
        targetType: "PLATFORM_BOT",
        targetId: platform,
        detail: { platform, enabled: body.enabled },
      },
    })
    .catch(() => null);

  return NextResponse.json(await getPlatformBotSwitches());
}
