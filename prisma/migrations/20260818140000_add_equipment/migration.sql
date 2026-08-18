-- Equipment as a set on both sides: what the brief requires, what the candidate
-- owns. Additive only — two nullable-by-default array columns.
ALTER TABLE "hiring_briefs" ADD COLUMN "required_equipment" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "candidates" ADD COLUMN "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[];
