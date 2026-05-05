import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const FB_KEYS = ["facebook.page_access_token", "facebook.app_secret", "facebook.verify_token"];

// ─── GET — return whether configured (never expose raw values) ───────────────

export const GET = auth(async (req) => {
  if (req.auth?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await db.setting.findMany({ where: { key: { in: FB_KEYS } } });
  const has = (k: string) => settings.some((s) => s.key === k);

  return NextResponse.json({
    pageAccessToken: has("facebook.page_access_token") ? "SET" : "",
    appSecret:       has("facebook.app_secret")        ? "SET" : "",
    verifyToken:     has("facebook.verify_token")      ? "SET" : "",
    isConfigured:    settings.length === 3,
  });
});

// ─── PUT — save credentials ──────────────────────────────────────────────────

const putSchema = z.object({
  pageAccessToken: z.string().min(1),
  appSecret:       z.string().min(1),
  verifyToken:     z.string().min(1),
});

export const PUT = auth(async (req) => {
  if (req.auth?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { pageAccessToken, appSecret, verifyToken } = parsed.data;

  await Promise.all([
    db.setting.upsert({
      where: { key: "facebook.page_access_token" },
      update: { value: pageAccessToken },
      create: { key: "facebook.page_access_token", value: pageAccessToken },
    }),
    db.setting.upsert({
      where: { key: "facebook.app_secret" },
      update: { value: appSecret },
      create: { key: "facebook.app_secret", value: appSecret },
    }),
    db.setting.upsert({
      where: { key: "facebook.verify_token" },
      update: { value: verifyToken },
      create: { key: "facebook.verify_token", value: verifyToken },
    }),
  ]);

  return NextResponse.json({ ok: true });
});

// ─── DELETE — remove all FB credentials ─────────────────────────────────────

export const DELETE = auth(async (req) => {
  if (req.auth?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.setting.deleteMany({ where: { key: { in: FB_KEYS } } });
  return NextResponse.json({ ok: true });
});
