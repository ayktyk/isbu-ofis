CREATE TYPE "public"."ai_job_status" AS ENUM('draft', 'queued', 'in_progress', 'review_required', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ai_job_step_status" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."ai_review_status" AS ENUM('pending', 'approved', 'changes_requested');--> statement-breakpoint
CREATE TABLE "ai_job_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"artifact_type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"storage_path" varchar(1000),
	"content_preview" text,
	"version_no" integer DEFAULT 1 NOT NULL,
	"source_step_key" varchar(100),
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_job_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"artifact_id" uuid,
	"review_type" varchar(100) NOT NULL,
	"status" "ai_review_status" DEFAULT 'pending' NOT NULL,
	"review_notes" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_name" varchar(255) NOT NULL,
	"source_locator" varchar(1000),
	"is_enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"filter_config" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_job_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"step_key" varchar(100) NOT NULL,
	"step_label" varchar(255) NOT NULL,
	"step_order" integer NOT NULL,
	"status" "ai_job_step_status" DEFAULT 'pending' NOT NULL,
	"input_snapshot" text,
	"output_snapshot" text,
	"error_message" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"job_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" "ai_job_status" DEFAULT 'draft' NOT NULL,
	"current_step_key" varchar(100),
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_job_artifacts" ADD CONSTRAINT "ai_job_artifacts_job_id_ai_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ai_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_job_artifacts" ADD CONSTRAINT "ai_job_artifacts_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_job_reviews" ADD CONSTRAINT "ai_job_reviews_job_id_ai_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ai_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_job_reviews" ADD CONSTRAINT "ai_job_reviews_artifact_id_ai_job_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."ai_job_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_job_reviews" ADD CONSTRAINT "ai_job_reviews_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_job_sources" ADD CONSTRAINT "ai_job_sources_job_id_ai_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ai_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_job_steps" ADD CONSTRAINT "ai_job_steps_job_id_ai_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ai_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_job_artifacts_job_idx" ON "ai_job_artifacts" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ai_job_artifacts_case_idx" ON "ai_job_artifacts" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "ai_job_reviews_job_idx" ON "ai_job_reviews" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ai_job_reviews_artifact_idx" ON "ai_job_reviews" USING btree ("artifact_id");--> statement-breakpoint
CREATE INDEX "ai_job_sources_job_idx" ON "ai_job_sources" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ai_job_steps_job_idx" ON "ai_job_steps" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_job_steps_job_step_key_idx" ON "ai_job_steps" USING btree ("job_id","step_key");--> statement-breakpoint
CREATE INDEX "ai_jobs_case_idx" ON "ai_jobs" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "ai_jobs_status_idx" ON "ai_jobs" USING btree ("status");
