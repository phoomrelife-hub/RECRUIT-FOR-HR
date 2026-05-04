import { auth } from "@/lib/auth";
import { testConnection } from "@/lib/openclaw-client";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await testConnection();
  return NextResponse.json(result);
}
