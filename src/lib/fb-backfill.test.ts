import { describe, expect, it } from "vitest";
import { planBackfill, type GraphMessage } from "./fb-backfill";

const PSID = "111";
const msg = (over: Partial<GraphMessage>): GraphMessage => ({
  id: "m_1",
  created_time: "2026-09-01T03:00:00+0000",
  from: { id: PSID },
  ...over,
});

describe("planBackfill", () => {
  it("plans a resume PDF with the bare mid, like the live webhook", () => {
    const rows = planBackfill(msg({ attachments: { data: [{ mime_type: "application/pdf" }] } }), PSID, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ externalId: "m_1", messageType: "file", mediaUrl: "/api/media/facebook/m_1?i=0" });
    expect(rows[0].createdAt.toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });

  it("detects images from the mime type", () => {
    const [r] = planBackfill(msg({ attachments: { data: [{ mime_type: "image/jpeg" }] } }), PSID, new Set());
    expect(r.messageType).toBe("image");
  });

  it("when text came with the file, the text row already holds the mid", () => {
    const rows = planBackfill(
      msg({ message: "ส่งเรซูเม่ค่ะ", attachments: { data: [{ mime_type: "application/pdf" }] } }),
      PSID,
      new Set(["m_1"]),
    );
    expect(rows.map((r) => r.externalId)).toEqual(["m_1#0"]);
  });

  it("is idempotent: rows already stored are skipped", () => {
    const rows = planBackfill(msg({ attachments: { data: [{ mime_type: "application/pdf" }] } }), PSID, new Set(["m_1"]));
    expect(rows).toEqual([]);
  });

  it("ignores messages the page sent and text-only messages", () => {
    expect(planBackfill(msg({ from: { id: "page" }, attachments: { data: [{ mime_type: "application/pdf" }] } }), PSID, new Set())).toEqual([]);
    expect(planBackfill(msg({ message: "hi" }), PSID, new Set())).toEqual([]);
  });
});
