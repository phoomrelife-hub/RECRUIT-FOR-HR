-- Proximity threshold on a brief, the resolved tier on a score, and a separate
-- timestamp for the Notion read.
--
-- Additive only: three nullable columns, no data rewritten.

ALTER TABLE "hiring_briefs" ADD COLUMN "min_proximity" TEXT;
ALTER TABLE "candidate_brief_scores" ADD COLUMN "proximity_tier" TEXT;
ALTER TABLE "candidate_extractions" ADD COLUMN "notion_synced_at" TIMESTAMP(3);
