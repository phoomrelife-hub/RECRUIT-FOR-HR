import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import type { Tier } from "@/lib/experience-tier";

export type AutoQualifySettings = {
  expPassTiers: Tier[];   // tiers that AUTO-QUALIFY (empty = skip rule)
  salaryMax: number | null;  // max acceptable salary (null = skip)
  salesMin: number | null;   // min max-sales required (null = skip)
};

const DEFAULT_SETTINGS: AutoQualifySettings = {
  expPassTiers: [],
  salaryMax: null,
  salesMin: null,
};

// GET /api/settings/auto-qualify
export async function GET() {
  await auth();

  const rows = await db.setting.findMany({
    where: { key: { in: ["autoqual.exp_pass_tiers", "autoqual.salary_max", "autoqual.sales_min"] } },
    select: { key: true, value: true },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const expPassTiers: Tier[] = map["autoqual.exp_pass_tiers"]
    ? (map["autoqual.exp_pass_tiers"].split(",").filter(Boolean) as Tier[])
    : [];

  return NextResponse.json({
    expPassTiers,
    salaryMax: map["autoqual.salary_max"] ? parseInt(map["autoqual.salary_max"]) : null,
    salesMin:  map["autoqual.sales_min"]  ? parseInt(map["autoqual.sales_min"])  : null,
  } satisfies AutoQualifySettings);
}

// PUT /api/settings/auto-qualify
// Body: AutoQualifySettings
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: AutoQualifySettings = await req.json();

  const ops = [
    db.setting.upsert({
      where: { key: "autoqual.exp_pass_tiers" },
      update: { value: (body.expPassTiers ?? []).join(",") },
      create: { key: "autoqual.exp_pass_tiers", value: (body.expPassTiers ?? []).join(",") },
    }),
    db.setting.upsert({
      where: { key: "autoqual.salary_max" },
      update: { value: body.salaryMax != null ? String(body.salaryMax) : "" },
      create: { key: "autoqual.salary_max", value: body.salaryMax != null ? String(body.salaryMax) : "" },
    }),
    db.setting.upsert({
      where: { key: "autoqual.sales_min" },
      update: { value: body.salesMin != null ? String(body.salesMin) : "" },
      create: { key: "autoqual.sales_min", value: body.salesMin != null ? String(body.salesMin) : "" },
    }),
  ];

  await Promise.all(ops);
  return NextResponse.json({ ok: true });
}

export { DEFAULT_SETTINGS };
