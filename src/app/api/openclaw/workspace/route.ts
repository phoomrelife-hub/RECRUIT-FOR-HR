import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const ALLOWED_FILES = ["SOUL.md", "POSITIONS.md", "RULES.md", "EXAMPLES.md"];
const FILE_KEY = (fname: string) => `openclaw.file.${fname}`;
const DIRTY_KEY = "openclaw.file.dirty";

const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

/**
 * GET /api/openclaw/workspace
 * Returns current workspace file contents from DB.
 * Public — called by UI on load AND by middleware.py (check_dirty=1).
 *
 * Query params:
 *   ?check_dirty=1   → only return files if dirty=true (for middleware.py polling)
 */
export async function GET(req: NextRequest) {
  const checkDirty = req.nextUrl.searchParams.get("check_dirty") === "1";

  const allKeys = [...ALLOWED_FILES.map(FILE_KEY), DIRTY_KEY];
  const rows = await db.setting.findMany({ where: { key: { in: allKeys } } });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  const dirty = !!map[DIRTY_KEY]; // non-empty string = dirty
  const files: Record<string, string> = {};
  for (const fname of ALLOWED_FILES) {
    const val = map[FILE_KEY(fname)];
    if (val) files[fname] = val;
  }

  if (checkDirty) {
    // middleware.py is asking "should I pull new content?"
    return NextResponse.json(
      { dirty, files: dirty ? files : {} },
      { headers: CORS }
    );
  }

  return NextResponse.json({ files, dirty }, { headers: CORS });
}

/**
 * POST /api/openclaw/workspace
 * Called by middleware.py to push current file contents (on startup + periodic sync).
 * No auth — middleware.py has no session cookie.
 *
 * Body variants:
 *   { files: { "SOUL.md": "...", ... } }  → save files (only if not dirty)
 *   { clear_dirty: true }                 → clear dirty flag after applying changes
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Clear dirty flag — called by middleware.py after it has written files
  if (body.clear_dirty) {
    await db.setting.upsert({
      where: { key: DIRTY_KEY },
      update: { value: "" },
      create: { key: DIRTY_KEY, value: "" },
    });
    return NextResponse.json({ ok: true }, { headers: CORS });
  }

  const files = body.files as Record<string, string> | undefined;
  if (!files) return NextResponse.json({ error: "no files" }, { status: 400, headers: CORS });

  // Don't overwrite if UI has pending changes not yet synced to bot
  const dirtyRow = await db.setting.findUnique({ where: { key: DIRTY_KEY } });
  if (dirtyRow?.value) {
    return NextResponse.json({ ok: true, skipped: "pending_ui_changes" }, { headers: CORS });
  }

  await Promise.all(
    Object.entries(files)
      .filter(([fname]) => ALLOWED_FILES.includes(fname))
      .map(([fname, content]) =>
        db.setting.upsert({
          where: { key: FILE_KEY(fname) },
          update: { value: content },
          create: { key: FILE_KEY(fname), value: content },
        })
      )
  );

  return NextResponse.json({ ok: true }, { headers: CORS });
}

/**
 * PUT /api/openclaw/workspace
 * Called by UI when HR edits and saves workspace files.
 * Requires auth (HR_MANAGER+).
 * Sets dirty=true so middleware.py knows to pull and write to filesystem.
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "HR_STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const files = body.files as Record<string, string> | undefined;
  if (!files) return NextResponse.json({ error: "no files" }, { status: 400 });

  const dirtyTs = new Date().toISOString();

  await Promise.all([
    ...Object.entries(files)
      .filter(([fname]) => ALLOWED_FILES.includes(fname))
      .map(([fname, content]) =>
        db.setting.upsert({
          where: { key: FILE_KEY(fname) },
          update: { value: content },
          create: { key: FILE_KEY(fname), value: content },
        })
      ),
    // Set dirty flag → middleware.py will pick this up on next poll and write to files
    db.setting.upsert({
      where: { key: DIRTY_KEY },
      update: { value: dirtyTs },
      create: { key: DIRTY_KEY, value: dirtyTs },
    }),
  ]);

  return NextResponse.json({ ok: true, dirtyTs });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
