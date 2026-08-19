// End-to-end proof of the per-platform bot kill switch, run against `next dev`.
//
// It fires REAL signed Facebook webhooks at the app and watches a stand-in
// bridge server: a hit on the bridge means "the bot would have replied".
// Nothing here mocks the route — the only fake part is the far end of the wire.
import crypto from "crypto";
import fs from "fs";
import { db } from "../src/lib/db";

const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:3199";
const BRIDGE_LOG = process.env.E2E_BRIDGE_LOG!;
const PSID = "999000111222333";           // fake, obviously-not-real PSID
const LINE_ID = "U" + "e2e".padEnd(32, "0");

let pass = 0, fail = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  ok ? pass++ : fail++;
}

function bridgeHits(): number {
  return fs.readFileSync(BRIDGE_LOG, "utf8").split("\n").filter(Boolean).length;
}

async function sendFbMessage(text: string, mid: string) {
  const secret = (await db.setting.findUnique({ where: { key: "facebook.app_secret" } }))!.value;
  const body = JSON.stringify({
    object: "page",
    entry: [{ id: "page", time: Date.now(), messaging: [{
      sender: { id: PSID }, recipient: { id: "page" }, timestamp: Date.now(),
      message: { mid, text },
    }] }],
  });
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  const res = await fetch(`${BASE}/api/webhooks/facebook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": sig },
    body,
  });
  return res;
}

async function checkPaused(id: string) {
  const res = await fetch(`${BASE}/api/openclaw/check-paused?lineUserId=${id}`);
  return (await res.json()) as { paused: boolean; reason?: string };
}

async function setSwitch(platform: "LINE" | "FACEBOOK", enabled: boolean) {
  const key = `bot.enabled.${platform.toLowerCase()}`;
  const value = enabled ? "true" : "false";
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

async function cleanup() {
  await db.setting.deleteMany({ where: { key: { in: ["bot.enabled.line", "bot.enabled.facebook"] } } });
  const c = await db.candidate.findUnique({ where: { facebookUserId: PSID } });
  if (c) {
    const convs = await db.conversation.findMany({ where: { candidateId: c.id }, select: { id: true } });
    await db.message.deleteMany({ where: { conversationId: { in: convs.map(x => x.id) } } });
    await db.humanTakeover.deleteMany({ where: { conversationId: { in: convs.map(x => x.id) } } });
    await db.aIConversation.deleteMany({ where: { conversationId: { in: convs.map(x => x.id) } } });
    await db.conversation.deleteMany({ where: { candidateId: c.id } });
    await db.candidateStatusHistory.deleteMany({ where: { candidateId: c.id } });
    await db.candidate.delete({ where: { id: c.id } });
  }
}

(async () => {
  await cleanup(); // start from a known-clean slate

  console.log("\n─── BASELINE: no switch rows at all (fresh DB behaviour) ───");
  {
    const before = bridgeHits();
    await sendFbMessage("สนใจสมัครงานค่ะ", "e2e-baseline-1");
    await new Promise(r => setTimeout(r, 1500));
    check("FB bot replies when no switch row exists", bridgeHits() === before + 1,
      `bridge hits ${before} → ${bridgeHits()}`);
    check("LINE check-paused says not paused", (await checkPaused(LINE_ID)).paused === false);
    check("FB check-paused says not paused", (await checkPaused(PSID)).paused === false);
  }

  console.log("\n─── FACEBOOK OFF ───");
  await setSwitch("FACEBOOK", false);
  {
    const before = bridgeHits();
    const msgsBefore = await db.message.count({ where: { conversation: { candidate: { facebookUserId: PSID } } } });
    const res = await sendFbMessage("ยังเปิดรับสมัครอยู่ไหมคะ", "e2e-fb-off-1");

    await new Promise(r => setTimeout(r, 1500));
    check("webhook still returns 200 (Meta must not see an error)", res.status === 200, `status ${res.status}`);
    check("bot did NOT reply — bridge untouched", bridgeHits() === before,
      `bridge hits ${before} → ${bridgeHits()}`);

    const msgsAfter = await db.message.count({ where: { conversation: { candidate: { facebookUserId: PSID } } } });
    check("candidate's message STILL saved to Inbox", msgsAfter === msgsBefore + 1,
      `messages ${msgsBefore} → ${msgsAfter}`);

    const fbPaused = await checkPaused(PSID);
    check("check-paused tells the VPS to stay silent on FB", fbPaused.paused === true,
      JSON.stringify(fbPaused));

    const linePaused = await checkPaused(LINE_ID);
    check("LINE is UNAFFECTED — still answering", linePaused.paused === false,
      JSON.stringify(linePaused));
  }

  console.log("\n─── LINE OFF, FACEBOOK BACK ON (the switches are independent) ───");
  await setSwitch("FACEBOOK", true);
  await setSwitch("LINE", false);
  {
    const before = bridgeHits();
    await sendFbMessage("ขอรายละเอียดตำแหน่งหน่อยค่ะ", "e2e-fb-on-2");
    await new Promise(r => setTimeout(r, 1500));
    check("FB bot replies again after switching back on", bridgeHits() === before + 1,
      `bridge hits ${before} → ${bridgeHits()}`);
    check("LINE now paused", (await checkPaused(LINE_ID)).paused === true);
    check("FB not paused", (await checkPaused(PSID)).paused === false);
  }

  console.log("\n─── an unknown first-time LINE user is still silenced ───");
  {
    const stranger = "U" + "neverseen".padEnd(32, "1");
    const r = await checkPaused(stranger);
    check("stranger with no candidate row is paused too", r.paused === true, JSON.stringify(r));
  }

  console.log("\n─── per-conversation takeover still wins even with the channel ON ───");
  await setSwitch("LINE", true);
  await setSwitch("FACEBOOK", true);
  {
    const c = await db.candidate.findUnique({ where: { facebookUserId: PSID } });
    await db.conversation.updateMany({ where: { candidateId: c!.id }, data: { botEnabled: false } });
    const r = await checkPaused(PSID);
    check("HR takeover on one chat still pauses that chat", r.paused === true, JSON.stringify(r));

    const before = bridgeHits();
    await sendFbMessage("ตามเรื่องค่ะ", "e2e-takeover-1");
    await new Promise(r2 => setTimeout(r2, 1500));
    check("and the FB webhook respects it", bridgeHits() === before, `bridge hits ${before} → ${bridgeHits()}`);
  }

  await cleanup();
  console.log(`\n${fail === 0 ? "ALL GREEN" : "FAILURES"}: ${pass} passed, ${fail} failed`);
  console.log("cleanup: test candidate + switch rows removed\n");
  process.exit(fail === 0 ? 0 : 1);
})().catch(async (e) => { console.error(e); await cleanup(); process.exit(1); });
