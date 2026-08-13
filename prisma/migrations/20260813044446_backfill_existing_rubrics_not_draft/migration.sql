-- Existing rubric rows predate the draft concept; they are already in use.
UPDATE "ai_scoring_configs" SET "is_draft" = false WHERE "approved_at" IS NULL;
