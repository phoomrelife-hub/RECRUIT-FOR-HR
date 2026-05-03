-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_SCREENING_FORM';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_SCREENING_FORM';
ALTER TYPE "AuditAction" ADD VALUE 'DELETE_SCREENING_FORM';
ALTER TYPE "AuditAction" ADD VALUE 'SUBMIT_SCREENING_ANSWERS';
ALTER TYPE "AuditAction" ADD VALUE 'SCORE_CANDIDATE';
ALTER TYPE "AuditAction" ADD VALUE 'GENERATE_AI_SUMMARY';
