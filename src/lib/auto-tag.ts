import { db } from "./db";

const POSITION_TAG_COLOR = "#8b5cf6"; // violet — visually distinct from manual tags

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
