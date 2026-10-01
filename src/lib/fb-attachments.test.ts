import { describe, expect, it } from "vitest";
import { describeFbAttachments } from "./fb-attachments";

describe("describeFbAttachments", () => {
  it("turns a PDF resume into a file message behind the proxy", () => {
    const out = describeFbAttachments({
      mid: "m_abc",
      attachments: [{ type: "file", payload: { url: "https://cdn.fb/expiring.pdf" } }],
    });
    expect(out).toEqual([
      {
        externalId: "m_abc",
        messageType: "file",
        content: "[📎 ไฟล์แนบ]",
        mediaUrl: "/api/media/facebook/m_abc?i=0",
      },
    ]);
  });

  it("never stores the expiring CDN url", () => {
    const [a] = describeFbAttachments({ mid: "m1", attachments: [{ type: "image", payload: { url: "https://cdn.fb/x.jpg" } }] });
    expect(a.mediaUrl).not.toContain("cdn.fb");
  });

  it("gives each of several attachments its own id and index", () => {
    const out = describeFbAttachments({
      mid: "m_2",
      attachments: [{ type: "image" }, { type: "image" }],
    });
    expect(out.map((a) => a.externalId)).toEqual(["m_2", "m_2#1"]);
    expect(out[1].mediaUrl).toBe("/api/media/facebook/m_2?i=1");
  });

  it("keeps a placeholder with no link for audio, skips location", () => {
    const out = describeFbAttachments({ mid: "m3", attachments: [{ type: "audio" }, { type: "location" }] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ messageType: "audio", mediaUrl: null });
  });

  it("returns nothing for a text-only message", () => {
    expect(describeFbAttachments({ mid: "m4", text: "hi" })).toEqual([]);
  });
});
