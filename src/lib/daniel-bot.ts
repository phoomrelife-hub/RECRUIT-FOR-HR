import { db } from "./db";
import { askKimi, type KimiMessage } from "./kimi";

const DEFAULT_SYSTEM_PROMPT = `คุณคือ Daniel ผู้ช่วย HR อัจฉริยะของบริษัท Relife

## เป้าหมายหลัก
คัดกรองผู้สมัครงานเบื้องต้น รวบรวมข้อมูลพื้นฐาน และแจ้งว่า HR จะติดต่อกลับ

## ลำดับการสนทนา
1. ทักทายและแนะนำตัวเป็น Daniel
2. ถามตำแหน่งที่สนใจ
3. ขอชื่อ-นามสกุลและอายุ
4. ถามประสบการณ์ทำงาน
5. ถามเงินเดือนที่ต้องการ
6. ถามวันเริ่มงาน
7. ขอบคุณและแจ้งว่า HR จะติดต่อกลับโดยเร็ว

## แนวทางการตอบ
ตอบเป็นภาษาไทย กระชับ สุภาพ เป็นมิตร ใช้ emoji ได้บ้าง ถามทีละคำถาม

## กฎสำคัญ
ห้ามระบุเงินเดือนหรือสวัสดิการที่ชัดเจน ห้ามตัดสินใจรับสมัครแทน HR`;

async function buildSystemPrompt(): Promise<string> {
  try {
    const settings = await db.setting.findMany({
      where: { key: { startsWith: "bot." } },
    });

    const config: Record<string, string> = {};
    for (const s of settings) {
      config[s.key.replace("bot.", "")] = s.value;
    }

    // ถ้าบอทถูก set เป็น inactive ให้ return null จะถูกจัดการที่ caller
    if (config.active === "false") return "";

    const SECTION_MAP: Array<{ key: string; label: string; labelEn: string }> = [
      { key: "objectives", label: "เป้าหมายหลัก", labelEn: "Primary Objectives" },
      { key: "company_info", label: "ข้อมูลบริษัท", labelEn: "Company Info" },
      { key: "conversation_flow", label: "ลำดับการสนทนา", labelEn: "Conversation Flow" },
      { key: "response_guidelines", label: "แนวทางการตอบ", labelEn: "Response Guidelines" },
      { key: "open_positions", label: "ตำแหน่งที่เปิดรับ", labelEn: "Open Positions" },
      { key: "critical_rules", label: "กฎสำคัญ", labelEn: "Critical Rules" },
      { key: "contact_info", label: "ข้อมูลติดต่อ HR", labelEn: "Contact Info" },
      { key: "custom_instructions", label: "คำสั่งเพิ่มเติม", labelEn: "Custom Instructions" },
    ];

    const parts = SECTION_MAP.map(({ key, label, labelEn }) => {
      const val = (config[key] ?? "").trim();
      if (!val) return null;
      return `## ${label} (${labelEn})\n${val}`;
    }).filter(Boolean);

    return parts.length > 0 ? parts.join("\n\n") : DEFAULT_SYSTEM_PROMPT;
  } catch {
    return DEFAULT_SYSTEM_PROMPT;
  }
}

type ConversationMessage = { role: "user" | "assistant"; content: string };

export async function getDanielReply(
  _candidateMsgCount: number,
  recentMessages: ConversationMessage[]
): Promise<string | null> {
  const systemPrompt = await buildSystemPrompt();

  // ถ้า active=false ให้บอทไม่ตอบ
  if (systemPrompt === "") return null;

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
