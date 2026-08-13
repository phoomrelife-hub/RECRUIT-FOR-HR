-- AlterTable
ALTER TABLE "ai_scoring_configs" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "is_draft" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "job_position_id" TEXT;

-- CreateTable
CREATE TABLE "candidate_assessments" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "job_position_id" TEXT,
    "rubric_config_id" TEXT,
    "overall_score" INTEGER NOT NULL,
    "coverage_pct" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "strengths" TEXT,
    "concerns" TEXT,
    "red_flags" TEXT,
    "unverified_claims" TEXT,
    "sources_used" JSONB NOT NULL,
    "interview_questions" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "cost_usd" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_criterion_scores" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "score" INTEGER,
    "reasoning" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "assessment_criterion_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_assessments_candidate_id_key" ON "candidate_assessments"("candidate_id");

-- AddForeignKey
ALTER TABLE "candidate_assessments" ADD CONSTRAINT "candidate_assessments_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_criterion_scores" ADD CONSTRAINT "assessment_criterion_scores_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "candidate_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
