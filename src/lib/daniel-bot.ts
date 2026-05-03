import { db } from "./db";
import { askKimi, type KimiMessage } from "./kimi";

const FALLBACK_PROMPT = `คุณคือ Daniel ผู้ช่วย HR อัจฉริยะของบริษัท Relife
หน้าที่ของคุณคือคัดกรองผู้สมัครงานเบื้องต้นผ่าน LINE
ตอบเป็นภาษาไทย กระชับ สุภาพ และเป็นมิตร
ถามข้อมูลที่จำเป็น: ตำแหน่งที่สนใจ, ชื่อ-อายุ, ประสบการณ์, เงินเดือนที่ต้องการ, วันเริ่มงาน
ห้ามให้ข้อมูลเงินเดือน หรือตัดสินใจรับสมัครแทน HR`;

async function getSystemPrompt(): Promise<string> {
  try {
    const settings = await db.setting.findMany({
      where: { key: { startsWith: "ai.prompt." } },
    });

    const config: Record<string, string> = {};
    for (const s of settings) config[s.key.replace("ai.prompt.", "")] = s.value;

    if (config.active === "false") return "";

    const sections = [
      { key: "objectives", label: "เป้าหมายหลัก" },
      { key: "company_info", label: "ข้อมูลบริษัท" },
      { key: "conversation_flow", label: "ลำดับการสนทนา" },
      { key: "response_guidelines", label: "แนวทางการตอบ" },
      { key: "faqs", label: "คำถามที่พบบ่อย" },
      { key: "critical_rules", label: "กฎสำคัญ" },
      { key: "position_info", label: "ข้อมูลตำแหน่งงาน" },
      { key: "contact_info", label: "ข้อมูลติดต่อ HR" },
      { key: "response_templates", label: "Template การตอบ" },
      { key: "custom_instructions", label: "คำสั่งเพิ่มเติม" },
    ];

    const parts = sections
      .map(({ key, label }) => {
        const val = (config[key] ?? "").trim();
        return val ? `## ${label}\n${val}` : null;
      })
      .filter(Boolean);

    return parts.length > 0 ? parts.join("\n\n") : FALLBACK_PROMPT;
  } catch {
    return FALLBACK_PROMPT;
  }
}

type ConversationMessage = { role: "user" | "assistant"; content: string };

export async function getDanielReply(
  _candidateMsgCount: number,
  recentMessages: ConversationMessage[]
): Promise<string> {
  const systemPrompt = await getSystemPrompt();

  if (!systemPrompt) {
    return "ขอบคุณสำหรับข้อความนะครับ ทีม HR จะติดต่อกลับไปในเร็วๆ นี้ครับ 🙏";
  }

  const messages: KimiMessage[] = [
    { role: "system", content: systemPrompt },
    ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    return await askKimi(messages);
  } catch {
    return "ขอบคุณสำหรับข้อความนะครับ ทีม HR จะติดต่อกลับไปในเร็วๆ นี้ครับ 🙏";
  }
}
