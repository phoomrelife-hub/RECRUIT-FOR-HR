-- Brief-driven candidate matching.
--
-- Purely additive: three new tables, no ALTER on anything that already exists.
-- Safe to run against production while the app is serving traffic.

-- CreateTable
CREATE TABLE "hiring_briefs" (
    "id" TEXT NOT NULL,
    "job_position_id" TEXT NOT NULL,
    "raw_brief" TEXT NOT NULL,
    "min_age" INTEGER,
    "max_age" INTEGER,
    "min_salary" INTEGER,
    "max_salary" INTEGER,
    "work_preference" "WorkPreference",
    "min_experience_years" INTEGER,
    "min_sales_amount" INTEGER,
    "criteria" JSONB NOT NULL DEFAULT '[]',
    "brief_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notify_stars" INTEGER NOT NULL DEFAULT 5,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hiring_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_brief_scores" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "overall_score" INTEGER NOT NULL DEFAULT 0,
    "coverage_pct" INTEGER NOT NULL DEFAULT 0,
    "criteria" JSONB NOT NULL DEFAULT '[]',
    "why" TEXT NOT NULL DEFAULT '',
    "filtered_out" BOOLEAN NOT NULL DEFAULT false,
    "filter_reason" TEXT,
    "brief_hash" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT '',
    "cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_brief_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_extractions" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "experience_years" INTEGER,
    "found_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL DEFAULT '',
    "extracted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hiring_briefs_job_position_id_key" ON "hiring_briefs"("job_position_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_brief_scores_candidate_id_brief_id_key" ON "candidate_brief_scores"("candidate_id", "brief_id");

-- CreateIndex
CREATE INDEX "candidate_brief_scores_brief_id_stars_notified_at_idx" ON "candidate_brief_scores"("brief_id", "stars", "notified_at");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_extractions_candidate_id_key" ON "candidate_extractions"("candidate_id");

-- AddForeignKey
ALTER TABLE "hiring_briefs" ADD CONSTRAINT "hiring_briefs_job_position_id_fkey" FOREIGN KEY ("job_position_id") REFERENCES "job_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring_briefs" ADD CONSTRAINT "hiring_briefs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_brief_scores" ADD CONSTRAINT "candidate_brief_scores_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_brief_scores" ADD CONSTRAINT "candidate_brief_scores_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "hiring_briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_extractions" ADD CONSTRAINT "candidate_extractions_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
