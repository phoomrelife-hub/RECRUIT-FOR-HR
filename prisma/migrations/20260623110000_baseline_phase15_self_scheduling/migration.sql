-- BASELINE MIGRATION — recorded as applied, never executed against the existing database.
--
-- Phase 15 (candidate self-scheduling) was applied to the live database outside the
-- migration flow (db push or manual DDL), so prisma/migrations never recorded it.
-- The objects below already exist in production and in schema.prisma; only the
-- migration history was missing them. That gap made `prisma migrate dev` see the
-- database as drifted and offer a destructive reset for every future migration.
--
-- This file closes the gap. It is registered with:
--     prisma migrate resolve --applied 20260623110000_baseline_phase15_self_scheduling
-- which only INSERTs a row into _prisma_migrations — it runs no DDL and touches no data.
--
-- The statements are written idempotently so that a from-scratch rebuild produces the
-- same schema, and so re-running against a database that already has them is harmless.

-- AlterEnum: CandidateStatus gained HIRED (between PASSED and REJECTED)
ALTER TYPE "CandidateStatus" ADD VALUE IF NOT EXISTS 'HIRED' BEFORE 'REJECTED';

-- AlterTable: candidate self-scheduling token
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "schedule_token" TEXT;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "schedule_token_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "candidates_schedule_token_key" ON "candidates"("schedule_token");

-- CreateTable
CREATE TABLE IF NOT EXISTS "interview_slots" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "interview_type" "InterviewType" NOT NULL DEFAULT 'ONSITE',
    "location" TEXT,
    "meeting_link" TEXT,
    "is_booked" BOOLEAN NOT NULL DEFAULT false,
    "booked_by_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_slots_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "interview_slots" DROP CONSTRAINT IF EXISTS "interview_slots_booked_by_id_fkey";
ALTER TABLE "interview_slots" ADD CONSTRAINT "interview_slots_booked_by_id_fkey" FOREIGN KEY ("booked_by_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_slots" DROP CONSTRAINT IF EXISTS "interview_slots_created_by_id_fkey";
ALTER TABLE "interview_slots" ADD CONSTRAINT "interview_slots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
