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

// Only verifyToken is required (needed for Meta webhook verification).
// Page Access Token + App Secret can be filled in later — only the provided
// fields are written, so saving the verify token alone is allowed.
const putSchema = z.object({
  pageAccessToken: z.string().optional(),
  appSecret:       z.string().optional(),
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

  const upsert = (key: string, value: string) =>
    db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });

  const ops = [upsert("facebook.verify_token", verifyToken)];
  if (pageAccessToken) ops.push(upsert("facebook.page_access_token", pageAccessToken));
  if (appSecret)       ops.push(upsert("facebook.app_secret", appSecret));

  await Promise.all(ops);

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
