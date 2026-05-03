-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_TAG';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_TAG';
ALTER TYPE "AuditAction" ADD VALUE 'DELETE_TAG';
ALTER TYPE "AuditAction" ADD VALUE 'ADD_CANDIDATE_TAG';
ALTER TYPE "AuditAction" ADD VALUE 'REMOVE_CANDIDATE_TAG';
ALTER TYPE "AuditAction" ADD VALUE 'ASSIGN_CANDIDATE';
ALTER TYPE "AuditAction" ADD VALUE 'UNASSIGN_CANDIDATE';
ALTER TYPE "AuditAction" ADD VALUE 'DELETE_CANDIDATE_NOTE';
