import { getFbHealth } from "@/lib/fb-health";

function bkk(d: Date): string {
  return d.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function since(d: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return `${mins} นาที`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชม. ${mins % 60} นาที`;
  const days = Math.floor(hours / 24);
  return `${days} วัน ${hours % 24} ชม.`;
}

/**
 * Shown on every dashboard page while Meta is refusing page-wide Facebook sends.
 * The 2026 outage ran 55 days unnoticed because the only symptom was silence —
 * candidates messaged in and the bot's replies vanished at the Graph API.
 */
export async function FbBlockBanner() {
  const health = await getFbHealth();
  if (!health.blocked || !health.since) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-base leading-none">
          🚨
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            Facebook Messenger ส่งข้อความไม่ได้ — ผู้สมัครทาง Facebook ไม่ได้รับคำตอบ
          </p>
          <p className="mt-1 text-red-800">
            Meta ปฏิเสธการส่งทั้งเพจ
            {health.code ? ` (error #${health.code})` : ""} มาแล้ว{" "}
            <span className="font-medium">{since(health.since)}</span> — เริ่มเมื่อ{" "}
            {bkk(health.since)}
            {health.failedCount > 0
              ? ` · ส่งไม่สำเร็จ ${health.failedCount.toLocaleString("th-TH")} ครั้ง`
              : ""}
          </p>
          {health.message ? (
            <p className="mt-1 break-words font-mono text-xs text-red-700">
              {health.message}
            </p>
          ) : null}
          <p className="mt-2 text-red-800">
            ตรวจสอบที่{" "}
            <a
              className="font-medium underline underline-offset-2"
              href="https://business.facebook.com/accountquality"
              target="_blank"
              rel="noopener noreferrer"
            >
              Business Suite → Account Quality
            </a>{" "}
            (LINE ยังทำงานปกติ)
          </p>
        </div>
      </div>
    </div>
  );
}
