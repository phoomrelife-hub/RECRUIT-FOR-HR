-- Persist the rendered Notion form Q&A so re-scoring keeps its best evidence
-- instead of falling back to the chat transcript alone.
ALTER TABLE "candidate_extractions" ADD COLUMN "notion_evidence" TEXT;
