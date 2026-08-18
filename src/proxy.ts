import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");

  if (isApiAuth) return NextResponse.next();

  // health check — Railway probes this; must return 200 without a session
  if (req.nextUrl.pathname === "/api/health") return NextResponse.next();

  // cron endpoint — self-fetched by instrumentation.ts; route checks CRON_SECRET
  if (req.nextUrl.pathname.startsWith("/api/cron")) return NextResponse.next();

  // public webhook endpoints — no auth required
  if (req.nextUrl.pathname.startsWith("/api/webhooks")) return NextResponse.next();

  // OpenClaw sync + backfill — called from local OpenClaw server, no session
  if (req.nextUrl.pathname === "/api/openclaw/sync") return NextResponse.next();
  if (req.nextUrl.pathname === "/api/openclaw/backfill-profiles") return NextResponse.next();
  if (req.nextUrl.pathname === "/api/openclaw/check-paused") return NextResponse.next();
  if (req.nextUrl.pathname === "/api/openclaw/config") return NextResponse.next();
  // Facebook page-block alert — outbound_dedup.py fires this with no session
  if (req.nextUrl.pathname === "/api/openclaw/fb-alert") return NextResponse.next();
  // Workspace sync — middleware.py pushes file contents (GET/POST public; PUT auth handled in route)
  if (req.nextUrl.pathname === "/api/openclaw/workspace") return NextResponse.next();

  // Telegram webhook — called from Telegram servers, no session
  if (req.nextUrl.pathname === "/api/telegram/webhook") return NextResponse.next();

  // Candidate self-scheduling — public page + API, no auth
  if (req.nextUrl.pathname.startsWith("/schedule")) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/schedule")) return NextResponse.next();

  // Admin one-time scripts — protected by x-admin-secret header (no session needed)
  if (req.nextUrl.pathname.startsWith("/api/admin/")) return NextResponse.next();

  // Redirect legacy paths
  if (req.nextUrl.pathname.startsWith("/bot-config")) {
    return NextResponse.redirect(new URL("/settings/ai", req.url));
  }
  if (req.nextUrl.pathname === "/settings") {
    return NextResponse.redirect(new URL("/settings/ai", req.url));
  }

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const res = NextResponse.next();
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
