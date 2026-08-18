import { NextResponse } from "next/server";
import { recordFbBlocked, recordFbRecovered } from "@/lib/fb-health";
import { sendOpsAlert } from "@/lib/telegram";

// outbound_dedup.py (VPS) calls this when Meta starts — or stops — refusing
// page-wide Facebook sends.
//
// Payload:
//   { status: "blocked",   errorCode, message, count, firstSeenAt }
//   { status: "recovered", failedCount, firstSeenAt }
//
// firstSeenAt is epoch milliseconds.

export const dynamic = "force-dynamic";

function bkk(d: Date): string {
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-openclaw-secret");
  if (
    process.env.OPENCLAW_SYNC_SECRET &&
    secret !== process.env.OPENCLAW_SYNC_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status;
  const firstSeenAt = new Date(Number(body.firstSeenAt) || Date.now());

  if (status === "blocked") {
    const code = Number(body.errorCode) || 0;
    const message = String(body.message ?? "");
    const count = Number(body.count) || 1;

    const { isNew } = await recordFbBlocked({ code, message, count, firstSeenAt });

    // Only page the humans on the first detection of an outage — subsequent
    // reports inside the same outage just refresh the stored counters.
    if (isNew) {
      await sendOpsAlert(
        `🚨 Facebook Messenger ส่งข้อความไม่ได้\n` +
          `─────────────────\n` +
          `Meta ปฏิเสธการส่งทั้งเพจ (error #${code})\n` +
          `${message}\n\n` +
          `เริ่มเมื่อ: ${bkk(firstSeenAt)}\n` +
          `ผู้สมัครที่ทักมาทาง Facebook จะไม่ได้รับคำตอบจนกว่าจะแก้\n\n` +
          `ตรวจสอบที่ Business Suite → Account Quality`
      );
    }
    return NextResponse.json({ ok: true, isNew });
  }

  if (status === "recovered") {
    const failedCount = Number(body.failedCount) || 0;
    const { wasBlocked, outageMinutes } = await recordFbRecovered({
      failedCount,
      firstSeenAt,
    });

    if (wasBlocked) {
      const hours = Math.floor(outageMinutes / 60);
      const mins = outageMinutes % 60;
      const dur = hours > 0 ? `${hours} ชม. ${mins} นาที` : `${mins} นาที`;
      await sendOpsAlert(
        `✅ Facebook Messenger กลับมาส่งได้แล้ว\n` +
          `─────────────────\n` +
          `ใช้เวลาแก้ไป: ${dur}\n` +
          `ข้อความที่ส่งไม่สำเร็จระหว่างนั้น: ${failedCount} ครั้ง`
      );
    }
    return NextResponse.json({ ok: true, wasBlocked });
  }

  return NextResponse.json({ error: "unknown status" }, { status: 400 });
}
