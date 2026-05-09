import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Proxy route: fetch LINE message content (image/file) on behalf of authenticated HR
// LINE stores message content for ~7 days after receipt
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { messageId } = await params;

  // Get LINE channel access token
  const setting = await db.setting.findUnique({ where: { key: "line.channel_access_token" } });
  const token = setting?.value || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return new Response("LINE not configured", { status: 503 });

  const res = await fetch(
    `https://api-data.line.me/v2/bot/message/${messageId}/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    return new Response("Media not found or expired", { status: 404 });
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = await res.arrayBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=604800", // 7 days (matches LINE retention)
    },
  });
}
