import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { briefHash } from "@/lib/brief/hash";
import { briefCriteria, briefFilters } from "@/lib/brief/run";
import { redactCriteria } from "@/lib/brief/redact";
import { withFallbackCriteria } from "@/lib/brief/parse";
import { TIER_ORDER, type ProximityTier } from "@/lib/brief/proximity";
import { EQUIPMENT_TOKENS, type EquipmentToken } from "@/lib/brief/equipment";
import type { BriefCriterion, HardFilters } from "@/lib/brief/types";
import type { Prisma, WorkPreference } from "@prisma/client";

// GET    /api/briefs/[id] — one brief
// PATCH  /api/briefs/[id] — HR corrects what the AI parsed (filters/criteria/notifyStars)
// DELETE /api/briefs/[id]

const FILTER_KEYS = [
  "minAge",
  "maxAge",
  "minSalary",
  "maxSalary",
  "minExperienceYears",
  "minSalesAmount",
] as const;

const WORK_VALUES = ["ONSITE", "WFH", "HYBRID"];

function asNullableInt(v: unknown): number | null {
  if (v === null || v === "" || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i > 0 ? i : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const brief = await db.hiringBrief.findUnique({
    where: { id },
    include: { jobPosition: { select: { id: true, title: true, workType: true } } },
  });
  if (!brief) return NextResponse.json({ error: "ไม่พบบรีฟ" }, { status: 404 });

  return NextResponse.json({ brief });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.hiringBrief.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ไม่พบบรีฟ" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const filters: HardFilters = { ...briefFilters(existing) };
  for (const key of FILTER_KEYS) {
    if (key in body) filters[key] = asNullableInt(body[key]);
  }
  if ("workPreference" in body) {
    const v = typeof body.workPreference === "string" ? body.workPreference.toUpperCase() : "";
    filters.workPreference = WORK_VALUES.includes(v) ? (v as WorkPreference) : null;
  }
  // A reversed range silently rejects everyone, so repair it here as well as in
  // the parser — HR can type one by hand just as easily as the model can.
  if (filters.minAge !== null && filters.maxAge !== null && filters.minAge > filters.maxAge) {
    [filters.minAge, filters.maxAge] = [filters.maxAge, filters.minAge];
  }
  if (
    filters.minSalary !== null &&
    filters.maxSalary !== null &&
    filters.minSalary > filters.maxSalary
  ) {
    [filters.minSalary, filters.maxSalary] = [filters.maxSalary, filters.minSalary];
  }

  if ("requiredEquipment" in body) {
    const raw = Array.isArray(body.requiredEquipment) ? body.requiredEquipment : [];
    // Filter against the canonical set: the UI sends tokens, but an unknown
    // value must never reach the column and become an unmeetable requirement.
    filters.requiredEquipment = EQUIPMENT_TOKENS.filter((t) =>
      (raw as unknown[]).includes(t as EquipmentToken),
    );
  }

  let minProximity = existing.minProximity;
  if ("minProximity" in body) {
    const v = typeof body.minProximity === "string" ? body.minProximity : "";
    minProximity = (TIER_ORDER as string[]).includes(v) ? (v as ProximityTier) : null;
  }

  let criteria: BriefCriterion[] = briefCriteria(existing);
  if (Array.isArray(body.criteria)) {
    criteria = redactCriteria(
      body.criteria
        .filter((c: unknown) => !!c && typeof c === "object")
        .map((c: Record<string, unknown>) => ({
          name: String(c.name ?? "").trim(),
          weight: Math.max(1, Math.min(5, asNullableInt(c.weight) ?? 1)),
          description: String(c.description ?? "").trim(),
        }))
        .filter((c: BriefCriterion) => c.name.length > 0),
    );
    // Same floor the parser applies: fewer than three criteria makes coverage
    // all-or-nothing and flattens the ranking, however carefully HR edited.
    criteria = withFallbackCriteria(criteria);
  }

  // null switches the full-spec route off; the UI sends 0 for that.
  const notifyFullSpecStars =
    "notifyFullSpecStars" in body
      ? (() => {
          const n = asNullableInt(body.notifyFullSpecStars);
          return n === null ? null : Math.max(1, Math.min(5, n));
        })()
      : existing.notifyFullSpecStars;

  const notifyStars =
    "notifyStars" in body
      ? Math.max(1, Math.min(5, asNullableInt(body.notifyStars) ?? existing.notifyStars))
      : existing.notifyStars;

  const hash = briefHash({ filters, criteria }, minProximity);

  const brief = await db.hiringBrief.update({
    where: { id },
    data: {
      ...filters,
      minProximity,
      criteria: criteria as unknown as Prisma.InputJsonValue,
      notifyStars,
      notifyFullSpecStars,
      briefHash: hash,
      ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
    },
  });

  // Scores keep their old briefHash and are simply treated as stale by
  // scoreForBrief — deleting them here would throw away a still-valid ranking
  // during the window before the next run.
  return NextResponse.json({ brief, hashChanged: hash !== existing.briefHash });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.hiringBrief.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
