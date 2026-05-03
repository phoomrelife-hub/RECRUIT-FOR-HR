import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const KEYS = {
  secret: "line.channel_secret",
  token: "line.channel_access_token",
};

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await db.setting.findMany({
    where: { key: { in: Object.values(KEYS) } },
  });

  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return NextResponse.json({
    channelSecret: map[KEYS.secret] ? "SET" : "",
    channelAccessToken: map[KEYS.token] ? "SET" : "",
    isConfigured: !!(map[KEYS.secret] && map[KEYS.token]),
  });
}

const saveSchema = z.object({
  channelSecret: z.string().min(1),
  channelAccessToken: z.string().min(1),
});

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { channelSecret, channelAccessToken } = parsed.data;

  await db.setting.upsert({
    where: { key: KEYS.secret },
    update: { value: channelSecret },
    create: { key: KEYS.secret, value: channelSecret },
  });

  await db.setting.upsert({
    where: { key: KEYS.token },
    update: { value: channelAccessToken },
    create: { key: KEYS.token, value: channelAccessToken },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.setting.deleteMany({
    where: { key: { in: Object.values(KEYS) } },
  });

  return NextResponse.json({ ok: true });
}
