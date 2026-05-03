export interface MockAiResponse {
  content: string;
  extractedFields: Record<string, string>;
  tags: string[];
  score: number;
  handoff: boolean;
  tokenEstimate: number;
  costEstimate: number;
  latencyMs: number;
}

const MOCK_RESPONSES = [
  "สวัสดีค่ะ! ขอบคุณที่สนใจตำแหน่งงานของเรานะคะ ช่วยบอกชื่อและเบอร์โทรได้เลยค่ะ",
  "ยอดเยี่ยมเลยค่ะ! ขอทราบประสบการณ์การทำงานของคุณได้ไหมคะ?",
  "ขอบคุณค่ะ! เงินเดือนที่คาดหวังประมาณเท่าไหร่คะ?",
  "รับทราบแล้วค่ะ ทีม HR จะติดต่อกลับเร็วๆ นี้นะคะ",
];

export function runMockAi(
  messages: { role: string; content: string }[],
  systemPrompt?: string
): MockAiResponse {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const content = lastUser
    ? MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
    : "สวัสดีค่ะ! มีอะไรให้ช่วยไหมคะ?";

  const tokenEstimate = Math.floor((systemPrompt?.length ?? 0) / 4) +
    messages.reduce((s, m) => s + Math.floor(m.content.length / 4), 0) +
    Math.floor(content.length / 4);

  return {
    content,
    extractedFields: extractFields(lastUser?.content ?? ""),
    tags: inferTags(lastUser?.content ?? ""),
    score: Math.floor(Math.random() * 40) + 40,
    handoff: detectHandoff(lastUser?.content ?? ""),
    tokenEstimate,
    costEstimate: parseFloat((tokenEstimate * 0.000003).toFixed(6)),
    latencyMs: Math.floor(Math.random() * 800) + 200,
  };
}

function extractFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const phoneMatch = text.match(/0[689]\d{8}/);
  if (phoneMatch) fields.phone = phoneMatch[0];
  const salaryMatch = text.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:บาท|฿|k)/i);
  if (salaryMatch) fields.expectedSalary = salaryMatch[1].replace(",", "");
  return fields;
}

function inferTags(text: string): string[] {
  const tags: string[] = [];
  if (/ประสบการณ์|experience|ปี/i.test(text)) tags.push("มีประสบการณ์");
  if (/จบใหม่|fresh|graduate/i.test(text)) tags.push("จบใหม่");
  if (/urgent|ด่วน|เร็ว/i.test(text)) tags.push("สนใจด่วน");
  return tags;
}

function detectHandoff(text: string): boolean {
  return /ผู้จัดการ|หัวหน้า|คุย|โทร|speak|manager|human/i.test(text);
}
