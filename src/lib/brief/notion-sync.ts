import { db } from "@/lib/db";
import { getNotionDetail, type NotionDetail } from "@/lib/notion-detail";
import { parseExperienceYears, parseThaiAmount } from "./thai-number";

/**
 * Pull the structured facts out of a candidate's Notion form page.
 *
 * THIS IS THE REAL FIX for the empty columns. Of 1,079 candidates holding a
 * Notion page, Postgres had `expected_salary` on 0, `max_sales_amount` on 0 and
 * `age` on 9 — while Notion held all three the whole time. The form was never
 * synced past name/phone, so every filter built on those fields was inert and
 * looked like a model failure rather than a plumbing one.
 *
 * Notion is the SOURCE OF TRUTH for anything the form asks: address, age,
 * experience, expected salary, ยอดขายสูงสุด, and the deep Q&A. Chat is only
 * consulted for what the form cannot know — chiefly whether someone will
 * actually come into the office (see extract.ts).
 */

export interface NotionFacts {
  age: number | null;
  address: string | null;
  experienceText: string | null;
  experienceYears: number | null;
  expectedSalary: number | null;
  maxSalesAmount: number | null;
  /** Deep Q&A, the richest evidence we hold — 14 answers on a typical page. */
  qa: Array<{ question: string; answer: string }>;
  /**
   * Attachments, as Google Drive links.
   *
   * Sparse by nature: across 1,753 form submissions only 102 attach a resume
   * and 28 a portfolio. So this is a bonus for the few who bother, never
   * something to filter on — requiring a resume would discard 94% of the pool.
   */
  resumeUrl: string | null;
  portfolioUrl: string | null;
  /** Which fields the page actually supported. */
  found: string[];
}

export const EMPTY_NOTION_FACTS: NotionFacts = {
  age: null,
  address: null,
  experienceText: null,
  experienceYears: null,
  expectedSalary: null,
  maxSalesAmount: null,
  qa: [],
  resumeUrl: null,
  portfolioUrl: null,
  found: [],
};

/**
 * Pull a usable href out of a free-text field.
 *
 * "Portfolio Link" is plain text on the form, and people paste things like
 * "www.tiktok.com/@chx_aem12    ปกติหนูมีช่องหลัก..." — a bare host followed by
 * a sentence. Stored raw that becomes a relative href in the browser and a
 * malformed button URL in Lark, so it is extracted and given a scheme here.
 */
export function firstUrl(text: string | null | undefined): string | null {
  if (!text) return null;

  // An explicit TLD list rather than a generic `word.word` pattern: the loose
  // version happily matches "resume.pdf" and turns a filename into a link.
  const TLD = "com|net|org|co|io|me|dev|app|xyz|th|info|biz|link|site|page|be|tv|cc";
  const m = text.match(
    new RegExp(
      `(https?:\\/\\/\\S+|(?:www\\.)\\S+|[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:${TLD})(?:\\/\\S*)?)`,
      "i",
    ),
  );
  if (!m) return null;

  const raw = m[1].replace(/[.,)\]]+$/, "");
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? "").trim();
  return t.length > 1 ? t : null;
};

/**
 * Map a fetched Notion page onto our fields.
 *
 * Pure, so the parsing is testable without a Notion token — and it needs
 * testing, because property sets differ BETWEEN PAGES. Older submissions have
 * no "ยอดขายที่เคยทำได้สูงสุด (ต่อเดือน)" property at all, so every read has to
 * tolerate absence rather than assume the form is uniform.
 */
export function mapNotionFacts(detail: NotionDetail): NotionFacts {
  const info = detail.info;

  // Attachments live on allProps rather than info: getNotionDetail's `info`
  // predates the Resume/Portfolio columns being added to the form.
  const fileProp = (name: string): string | null => {
    const p = detail.allProps.find((x) => x.name === name);
    if (!p) return null;
    if (Array.isArray(p.value)) return p.value[0] ?? null;
    return typeof p.value === "string" && p.value ? p.value : null;
  };

  const experienceText = clean(info.experience);
  const facts: NotionFacts = {
    // Age is a real Notion `number` property, so it needs no parsing — the one
    // field that arrives clean.
    age: typeof info.age === "number" && info.age >= 15 && info.age <= 80 ? info.age : null,
    address: clean(info.address),
    experienceText,
    experienceYears: parseExperienceYears(experienceText),
    expectedSalary: parseThaiAmount(info.expectedSalary),
    maxSalesAmount: parseThaiAmount(info.maxSales),
    qa: detail.qa.filter((q) => q.question?.trim() && q.answer?.trim()),
    resumeUrl: fileProp("Resume"),
    // "Portfolio Link" is a plain URL field some candidates use instead of
    // uploading, so it is a fallback for the same thing.
    portfolioUrl: fileProp("Portfolio") ?? firstUrl(fileProp("Portfolio Link")),
    found: [],
  };

  facts.found = (
    [
      "age",
      "address",
      "experienceText",
      "experienceYears",
      "expectedSalary",
      "maxSalesAmount",
      "resumeUrl",
      "portfolioUrl",
    ] as const
  ).filter((k) => facts[k] !== null);
  if (facts.qa.length) facts.found.push("qa");

  return facts;
}

export interface NotionSyncResult {
  facts: NotionFacts;
  /** Columns actually written — empty when everything was already populated. */
  written: string[];
  /** Set when the page could not be read; the caller decides whether to care. */
  error: string | null;
}

/**
 * Fetch a candidate's Notion page and write what is missing into Postgres.
 *
 * Only fills columns that are still empty, for the same reason extract.ts does:
 * a value HR typed by hand outranks anything derived, and silently overwriting
 * it makes the record untrustworthy in both directions.
 */
export async function syncFromNotion(candidateId: string): Promise<NotionSyncResult> {
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    select: {
      notionPageId: true,
      age: true,
      address: true,
      experienceText: true,
      expectedSalary: true,
      maxSalesAmount: true,
      resumeUrl: true,
      portfolioUrl: true,
    },
  });
  if (!candidate) throw new Error(`ไม่พบผู้สมัคร ${candidateId}`);
  if (!candidate.notionPageId) {
    return { facts: EMPTY_NOTION_FACTS, written: [], error: "ไม่มี Notion page" };
  }

  let detail: NotionDetail;
  try {
    detail = await getNotionDetail(candidate.notionPageId);
  } catch (e) {
    return {
      facts: EMPTY_NOTION_FACTS,
      written: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const facts = mapNotionFacts(detail);

  const fill: Record<string, unknown> = {};
  if (candidate.age === null && facts.age !== null) fill.age = facts.age;
  if (!candidate.address && facts.address) fill.address = facts.address;
  if (!candidate.experienceText && facts.experienceText) {
    fill.experienceText = facts.experienceText;
  }
  if (candidate.expectedSalary === null && facts.expectedSalary !== null) {
    fill.expectedSalary = facts.expectedSalary;
  }
  if (candidate.maxSalesAmount === null && facts.maxSalesAmount !== null) {
    fill.maxSalesAmount = facts.maxSalesAmount;
  }
  if (!candidate.resumeUrl && facts.resumeUrl) fill.resumeUrl = facts.resumeUrl;
  if (!candidate.portfolioUrl && facts.portfolioUrl) fill.portfolioUrl = facts.portfolioUrl;

  if (Object.keys(fill).length) {
    await db.candidate.update({ where: { id: candidateId }, data: fill });
  }

  return { facts, written: Object.keys(fill), error: null };
}

/**
 * Render the form Q&A for the model.
 *
 * This is the evidence that actually answers a brief's soft criteria — 14
 * considered written answers beat a chat transcript where the candidate mostly
 * asked about the commute. Contact details are never included: the form does
 * collect phone, email and LINE ID, and they stay out by construction rather
 * than by asking the prompt nicely.
 */
export function renderNotionEvidence(facts: NotionFacts): string {
  const parts: string[] = [];
  if (facts.experienceText) parts.push(`ประสบการณ์: ${facts.experienceText}`);
  for (const q of facts.qa) parts.push(`ถาม: ${q.question}\nตอบ: ${q.answer}`);
  return parts.join("\n\n");
}
