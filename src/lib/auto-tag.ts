import { db } from "./db";

const POSITION_TAG_COLOR = "#8b5cf6"; // violet — visually distinct from manual tags

// ── Keyword-based Auto Tagging ────────────────────────────────────────────────
// Called from /api/openclaw/sync whenever a candidate sends a message.
// Fetches all active AiTaggingRule rows, matches keywords against the text,
// and upserts CandidateTag rows for any matches found.

export async function applyKeywordTagging(
  candidateId: string,
  text: string
): Promise<void> {
  if (!text || !text.trim()) return;

  const rules = await db.aiTaggingRule.findMany({ where: { isActive: true } });
  if (rules.length === 0) return;

  const textLower = text.toLowerCase();

  for (const rule of rules) {
    if (!rule.tagId) continue;

    let keywords: string[] = [];
    try {
      const parsed = JSON.parse(rule.condition);
      keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    } catch {
      continue;
    }

    const matched = keywords.some((kw) =>
      textLower.includes(kw.toLowerCase().trim())
    );
    if (!matched) continue;

    // Upsert — skip if tag already applied
    const existing = await db.candidateTag.findFirst({
      where: { candidateId, tagId: rule.tagId },
    });
    if (!existing) {
      await db.candidateTag.create({
        data: { candidateId, tagId: rule.tagId },
      });
    }
  }
}

export async function autoTagByPosition(
  candidateId: string,
  newPositionId: string | null | undefined,
  oldPositionId: string | null | undefined
) {
  // Unassign old position tag when position changes
  if (oldPositionId && oldPositionId !== newPositionId) {
    const oldPos = await db.jobPosition.findUnique({
      where: { id: oldPositionId },
      select: { title: true },
    });
    if (oldPos) {
      const oldTag = await db.tag.findFirst({ where: { name: oldPos.title } });
      if (oldTag) {
        await db.candidateTag.deleteMany({ where: { candidateId, tagId: oldTag.id } });
      }
    }
  }

  // Assign new position tag
  if (newPositionId) {
    const pos = await db.jobPosition.findUnique({
      where: { id: newPositionId },
      select: { title: true },
    });
    if (!pos) return;

    let tag = await db.tag.findFirst({ where: { name: pos.title } });
    if (!tag) {
      tag = await db.tag.create({ data: { name: pos.title, color: POSITION_TAG_COLOR } });
    }

    const existing = await db.candidateTag.findFirst({ where: { candidateId, tagId: tag.id } });
    if (!existing) {
      await db.candidateTag.create({ data: { candidateId, tagId: tag.id } });
    }
  }
}
