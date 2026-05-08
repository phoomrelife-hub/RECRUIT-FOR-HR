import { auth } from "@/lib/auth";
import { getBotInfo } from "@/lib/line";
import { NextResponse } from "next/server";

// Test the LINE channel access token by fetching the OA bot info
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botInfo = await getBotInfo();
  if (!botInfo) {
    return NextResponse.json(
      { ok: false, error: "Token ไม่ถูกต้อง หรือยังไม่ได้บันทึก Channel Access Token" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    displayName: botInfo.displayName,
    basicId: botInfo.basicId,
    pictureUrl: botInfo.pictureUrl,
  });
}
