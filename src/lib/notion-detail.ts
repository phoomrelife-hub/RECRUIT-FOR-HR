// Shared Notion candidate-detail fetch + parsing.
// Used by /api/candidates/[id]/notion-detail (HTTP) and the AI Assistant get_candidate tool.

function richText(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as Record<string, unknown>;
  const arr = (p.rich_text as unknown[]) ?? (p.title as unknown[]) ?? [];
  if (!Array.isArray(arr)) return "";
  return arr
    .map((c) => {
      const chunk = c as Record<string, unknown>;
      return typeof chunk.plain_text === "string" ? chunk.plain_text : "";
    })
    .join("")
    .trim();
}

function selectVal(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as Record<string, unknown>;
  const s = p.select as Record<string, unknown> | undefined;
  return typeof s?.name === "string" ? s.name : "";
}

function multiSelectVal(prop: unknown): string[] {
  if (!prop || typeof prop !== "object") return [];
  const p = prop as Record<string, unknown>;
  const arr = p.multi_select as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => (typeof s.name === "string" ? s.name : "")).filter(Boolean);
}

function numVal(prop: unknown): number | null {
  if (!prop || typeof prop !== "object") return null;
  const p = prop as Record<string, unknown>;
  return typeof p.number === "number" ? p.number : null;
}

function emailVal(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as Record<string, unknown>;
  return typeof p.email === "string" ? p.email : "";
}

function phoneVal(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as Record<string, unknown>;
  return typeof p.phone_number === "string" ? p.phone_number : "";
}

function urlVal(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as Record<string, unknown>;
  return typeof p.url === "string" ? p.url : "";
}

function dateVal(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as Record<string, unknown>;
  const d = p.date as Record<string, unknown> | undefined;
  return typeof d?.start === "string" ? d.start : "";
}

function filesVal(prop: unknown): string[] {
  if (!prop || typeof prop !== "object") return [];
  const p = prop as Record<string, unknown>;
  const arr = p.files as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((f) => {
      const ext = f.external as Record<string, unknown> | undefined;
      const file = f.file as Record<string, unknown> | undefined;
      return typeof ext?.url === "string"
        ? ext.url
        : typeof file?.url === "string"
        ? file.url
        : "";
    })
    .filter(Boolean) as string[];
}

async function notionFetch(url: string, token: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
    },
  });
  if (!res.ok) throw new Error(`Notion ${res.status}`);
  return res.json();
}

export interface NotionInfo {
  name: string;
  phone: string;
  email: string;
  age: number | null;
  children: number | null;
  address: string;
  position: string;
  experience: string;
  maxSales: string;
  expectedSalary: string;
  equipment: string[];
  lineId: string;
}

export type NotionPropType = "text" | "url" | "tags" | "number" | "files";
export interface NotionProp {
  name: string;
  type: NotionPropType;
  value: string | string[] | number;
}
export interface NotionQA {
  question: string;
  answer: string;
}
export interface NotionDetail {
  info: NotionInfo;
  allProps: NotionProp[];
  qa: NotionQA[];
}

/**
 * Fetch + parse a candidate's Notion page (properties + deep Q&A blocks).
 * Throws on a failed Notion API call (caller decides how to surface it).
 */
export async function getNotionDetail(
  pageId: string,
  token: string = process.env.NOTION_TOKEN ?? "",
): Promise<NotionDetail> {
  if (!token) throw new Error("NOTION_TOKEN not set");

  const [page, blocksData] = await Promise.all([
    notionFetch(`https://api.notion.com/v1/pages/${pageId}`, token),
    notionFetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, token),
  ]) as [Record<string, unknown>, Record<string, unknown>];

  const props = (page as { properties: Record<string, unknown> }).properties ?? {};

  const info: NotionInfo = {
    name:            richText(props["ชื่อ - นามสกุล / ชื่อเล่น"]),
    phone:           phoneVal(props["เบอร์โทรติดต่อ"]),
    email:           emailVal(props["อีเมลติดต่อ (Email)"]),
    age:             numVal(props["อายุ"]),
    children:        numVal(props["คุณมีบุตรกี่คน"]),
    address:         richText(props["ที่อยู่ปัจจุบัน"]),
    position:        selectVal(props["ตำแหน่งที่สมัคร"]),
    experience:      richText(props["คุณมีประสบการณ์ด้านงานขายมากี่ปี และเคยขายอะไรบ้าง?"]),
    maxSales:        richText(props["ยอดขายที่เคยทำได้สูงสุด (ต่อเดือน)"]),
    expectedSalary:  richText(props["รายได้ที่คาดหวัง (ต่อเดือน)"]),
    equipment:       multiSelectVal(props["อุปกรณ์ที่มีพร้อม (เลือกทั้งหมดที่มี)"]),
    lineId:          richText(props["ID Line ติดต่อกลับ"]),
  };

  const allProps: NotionProp[] = [];
  for (const [name, prop] of Object.entries(props)) {
    if (!prop || typeof prop !== "object") continue;
    const p = prop as Record<string, unknown>;
    const pType = p.type as string;
    let item: NotionProp | null = null;

    if (pType === "title" || pType === "rich_text") {
      const v = richText(prop);
      if (v) item = { name, type: "text", value: v };
    } else if (pType === "number") {
      const v = numVal(prop);
      if (v != null) item = { name, type: "number", value: v };
    } else if (pType === "select") {
      const v = selectVal(prop);
      if (v) item = { name, type: "text", value: v };
    } else if (pType === "multi_select") {
      const v = multiSelectVal(prop);
      if (v.length > 0) item = { name, type: "tags", value: v };
    } else if (pType === "email") {
      const v = emailVal(prop);
      if (v) item = { name, type: "text", value: v };
    } else if (pType === "phone_number") {
      const v = phoneVal(prop);
      if (v) item = { name, type: "text", value: v };
    } else if (pType === "url") {
      const v = urlVal(prop);
      if (v) item = { name, type: "url", value: v };
    } else if (pType === "files") {
      const v = filesVal(prop);
      if (v.length > 0) item = { name, type: "files", value: v };
    } else if (pType === "date") {
      const v = dateVal(prop);
      if (v) item = { name, type: "text", value: v };
    } else if (pType === "checkbox") {
      if ((prop as Record<string, unknown>).checkbox === true) {
        item = { name, type: "text", value: "✓" };
      }
    }

    if (item) allProps.push(item);
  }

  // Deep Q&A: h1 "📝 คำถามเชิงลึก", then pairs of h2 (question) + paragraph (answer)
  const qa: NotionQA[] = [];
  const blocks = (blocksData as { results: Array<Record<string, unknown>> }).results ?? [];
  let inDeepSection = false;
  let currentQuestion = "";

  for (const block of blocks) {
    const type = block.type as string;
    if (type === "heading_1") {
      const text = richText(block.heading_1);
      if (text.includes("คำถามเชิงลึก")) {
        inDeepSection = true;
        continue;
      }
    }
    if (!inDeepSection) continue;
    if (type === "heading_2") {
      currentQuestion = richText(block.heading_2);
    } else if (type === "paragraph" && currentQuestion) {
      const answer = richText(block.paragraph);
      qa.push({ question: currentQuestion, answer: answer || "(ไม่ได้ตอบ)" });
      currentQuestion = "";
    }
  }

  return { info, allProps, qa };
}
