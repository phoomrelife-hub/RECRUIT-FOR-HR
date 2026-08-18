-- The spec-match axis: how many stated requirements a candidate positively
-- meets, plus the lower star floor that lets a full match notify HR.
-- Additive only.
ALTER TABLE "hiring_briefs" ADD COLUMN "notify_full_spec_stars" INTEGER DEFAULT 3;
ALTER TABLE "candidate_brief_scores" ADD COLUMN "spec_met" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "candidate_brief_scores" ADD COLUMN "spec_total" INTEGER NOT NULL DEFAULT 0;
