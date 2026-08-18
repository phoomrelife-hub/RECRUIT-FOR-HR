/**
 * Live Lark test. Sends REAL messages to the configured webhook.
 *
 *   npx vitest run --config vitest.smoke.config.ts src/lib/brief/lark.smoke.ts
 */
import { describe, it, expect } from "vitest";
import { buildInstantCard, buildDigestCard, sendLark } from "../lark";

describe("live lark webhook", () => {
  it("sends the instant 5-star card", async () => {
    const res = await sendLark(
      buildInstantCard("Sales Admin (ทดสอบระบบ)", {
        name: "คุณสมหญิง (ตัวอย่าง)",
        stars: 5,
        why: "เคยขายอาหารเสริมออนไลน์ 3 ปี ยอดขายเดือนละ 250,000 เข้าออฟฟิศได้ และพร้อมเริ่มงานทันที",
        url: "https://recruit-for-hr-product.up.railway.app/candidates/demo",
        proximity: "ใกล้ออฟฟิศมาก",
        resumeUrl: "https://drive.google.com/file/d/1Yk1iJDdmJLAyt756NVGF6ZaQs1RRmpxd/preview",
        portfolioUrl: "https://www.tiktok.com/@chx_aem12",
      }),
    );
    console.log("instant:", res);
    expect(res.ok).toBe(true);
  }, 30_000);

  // Lark answers a BAD webhook with HTTP 200 and code 19001 in the body. If the
  // client trusted the status line it would report every send as delivered
  // forever, which is strictly worse than having no notifications at all.
  it("detects a dead webhook despite the 200 status", async () => {
    const real = process.env.LARK_RECRUIT_WEBHOOK;
    process.env.LARK_RECRUIT_WEBHOOK =
      "https://open.larksuite.com/open-apis/bot/v2/hook/00000000-dead-dead-dead-000000000000";
    try {
      const res = await sendLark({ msg_type: "text", content: { text: "x" } });
      console.log("bad webhook:", res);
      expect(res.ok).toBe(false);
      expect(res.error).toContain("19001");
    } finally {
      process.env.LARK_RECRUIT_WEBHOOK = real;
    }
  }, 30_000);

  it("sends the daily digest card", async () => {
    const res = await sendLark(
      buildDigestCard(
        "Sales Admin (ทดสอบระบบ)",
        [
          {
            name: "คุณมานี (ตัวอย่าง)",
            stars: 4,
            why: "ประสบการณ์ขายความงาม 2 ปี เข้าออฟฟิศได้",
            url: "https://recruit-for-hr-product.up.railway.app/candidates/demo1",
          },
          {
            name: "คุณสมชาย (ตัวอย่าง)",
            stars: 3,
            why: "เคยขายประกัน 4 ปี แต่ยังไม่เคยขายสินค้าสุขภาพ",
            url: "https://recruit-for-hr-product.up.railway.app/candidates/demo2",
          },
        ],
        "https://recruit-for-hr-product.up.railway.app/briefs/demo",
      ),
    );
    console.log("digest:", res);
    expect(res.ok).toBe(true);
  }, 30_000);
});
