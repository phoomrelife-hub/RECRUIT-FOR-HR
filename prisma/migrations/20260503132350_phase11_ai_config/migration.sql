-- CreateEnum
CREATE TYPE "PromptVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_PROVIDER';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_PERSONA';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_PROMPT';
ALTER TYPE "AuditAction" ADD VALUE 'PUBLISH_AI_PROMPT';
ALTER TYPE "AuditAction" ADD VALUE 'RESTORE_AI_PROMPT';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_SCREENING_FLOW';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_POSITION_RULE';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_FAQ';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_TEMPLATE';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_GUARDRAIL';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_HANDOFF_RULE';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_TAGGING_RULE';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_SCORING';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_SUMMARY_TEMPLATE';
ALTER TYPE "AuditAction" ADD VALUE 'RUN_AI_PLAYGROUND';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_COST_LIMIT';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_FALLBACK';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_AI_ROUTING';

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "api_key" TEXT,
    "base_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "default_model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_personas" (
    "id" TEXT NOT NULL,
    "bot_name" TEXT NOT NULL DEFAULT 'Daniel',
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "language" TEXT NOT NULL DEFAULT 'thai_english',
    "greeting" TEXT,
    "signature" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "PromptVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_screening_flows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "greeting" TEXT,
    "closing" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_screening_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_screening_questions" (
    "id" TEXT NOT NULL,
    "flow_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_screening_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_position_rules" (
    "id" TEXT NOT NULL,
    "job_position_id" TEXT,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "rule" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_position_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_faqs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_response_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_response_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_guardrails" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_guardrails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_handoff_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "trigger_value" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_handoff_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tagging_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "tag_id" TEXT,
    "tag_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_tagging_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Scoring',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_scoring_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scoring_categories" (
    "id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_scoring_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_summary_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_summary_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_playground_test_runs" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "provider_id" TEXT,
    "model" TEXT,
    "system_prompt" TEXT,
    "total_tokens" INTEGER,
    "total_cost" DOUBLE PRECISION,
    "latency_ms" INTEGER,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_playground_test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_playground_messages" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokens" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_playground_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_logs" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT,
    "model" TEXT,
    "action" TEXT NOT NULL,
    "candidate_id" TEXT,
    "prompt_tokens" INTEGER,
    "output_tokens" INTEGER,
    "total_tokens" INTEGER,
    "cost_estimate" DOUBLE PRECISION,
    "latency_ms" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_cost_limits" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'monthly',
    "limit_usd" DOUBLE PRECISION NOT NULL,
    "alert_at" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_cost_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_routing_rules" (
    "id" TEXT NOT NULL,
    "use_case" TEXT NOT NULL,
    "provider_id" TEXT,
    "model" TEXT,
    "max_tokens" INTEGER,
    "temperature" DOUBLE PRECISION DEFAULT 0.7,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_fallback_settings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_retries" INTEGER NOT NULL DEFAULT 2,
    "fallback_message" TEXT,
    "notify_hr" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_fallback_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_providers_name_key" ON "ai_providers"("name");

-- AddForeignKey
ALTER TABLE "ai_screening_questions" ADD CONSTRAINT "ai_screening_questions_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "ai_screening_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scoring_categories" ADD CONSTRAINT "ai_scoring_categories_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "ai_scoring_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_playground_messages" ADD CONSTRAINT "ai_playground_messages_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ai_playground_test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_routing_rules" ADD CONSTRAINT "ai_model_routing_rules_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
