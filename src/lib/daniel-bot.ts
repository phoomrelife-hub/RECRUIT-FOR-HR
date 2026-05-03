import { askKimi, type KimiMessage } from "./kimi";

const SCRIPT = [
  "สวัสดีครับ! ผมชื่อ Daniel 🤖 ผู้ช่วย HR ของ Relife ครับ\n\nตอนนี้เรากำลังเปิดรับสมัครงานหลายตำแหน่งครับ คุณสนใจสมัครตำแหน่งอะไรครับ?",
  "ขอบคุณครับ 🙏 ช่วยแนะนำตัวหน่อยนะครับ ชื่อ-นามสกุล และอายุของคุณครับ",
  "ยอดเยี่ยมเลยครับ! มีประสบการณ์ทำงานในสายงานนี้มาก่อนไหมครับ? ถ้ามีช่วยเล่าสั้นๆ ให้ฟังได้เลยครับ",
  "เข้าใจแล้วครับ 👍 อยากทราบเรื่องเงินเดือนที่ต้องการครับ คาดหวังไว้ประมาณเท่าไหร่ครับ?",
  "ได้เลยครับ แล้วสามารถเริ่มงานได้เร็วที่สุดเมื่อไหร่ครับ?",
  "ขอบคุณมากสำหรับข้อมูลครับ 🎉 ทีม HR จะทำการพิจารณาและติดต่อกลับโดยเร็วที่สุดครับ ขอให้โชคดีนะครับ! 😊",
];

const SYSTEM_PROMPT = `คุณคือ Daniel ผู้ช่วย HR อัจฉริยะของบริษัท Relife
หน้าที่ของคุณคือคัดกรองผู้สมัครงานเบื้องต้นผ่าน LINE
ตอบเป็นภาษาไทย กระชับ สุภาพ และเป็นมิตร
ถามข้อมูลที่จำเป็น: ตำแหน่งที่สนใจ, ชื่อ-อายุ, ประสบการณ์, เงินเดือนที่ต้องการ, วันเริ่มงาน
ห้ามให้ข้อมูลเงินเดือน หรือตัดสินใจรับสมัครแทน HR`;

type ConversationMessage = { role: "user" | "assistant"; content: string };

export async function getDanielReply(
  candidateMsgCount: number,
  recentMessages: ConversationMessage[]
): Promise<string> {
  const scriptIndex = candidateMsgCount - 1;

  // ใช้ script ถ้ายังอยู่ในขอบเขต
  if (scriptIndex >= 0 && scriptIndex < SCRIPT.length) {
    return SCRIPT[scriptIndex];
  }

  // off-script → ถาม Kimi
  const messages: KimiMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    return await askKimi(messages);
  } catch {
    return "ขอบคุณสำหรับข้อความนะครับ ทีม HR จะติดต่อกลับไปในเร็วๆ นี้ครับ 🙏";
  }
}
