import { auth } from "@/lib/auth";
import { getFbAttachmentUrl } from "@/lib/facebook";

// Proxy for Messenger attachments (resumes, photos) on behalf of authenticated HR.
// Meta's CDN links expire in hours, so a fresh one is requested per view.
export async function GET(req: Request, { params }: { params: Promise<{ mid: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { mid } = await params;
  const index = Math.max(0, Number(new URL(req.url).searchParams.get("i") ?? 0) || 0);

  const att = await getFbAttachmentUrl(decodeURIComponent(mid), index);
  if (!att) return new Response("Media not found or expired", { status: 404 });

  const upstream = await fetch(att.url, { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!upstream?.ok) return new Response("Media not found or expired", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "Cache-Control": "private, max-age=3600",
  };
  if (att.name) headers["Content-Disposition"] = `inline; filename*=UTF-8''${encodeURIComponent(att.name)}`;
  return new Response(await upstream.arrayBuffer(), { headers });
}
