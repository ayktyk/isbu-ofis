CREATE TYPE "public"."briefing_status" AS ENUM('draft', 'review_pending', 'approved');--> statement-breakpoint
CREATE TABLE "case_briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"version_no" integer DEFAULT 1 NOT NULL,
	"summary" text,
	"main_goal" text,
	"secondary_goal" text,
	"main_procedure_risk" text,
	"main_proof_risk" text,
	"tone_strategy" text,
	"markdown_content" text,
	"storage_path" varchar(1000),
	"status" "briefing_status" DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_intake_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"lawyer_direction" text,
	"client_interview_notes" text,
	"auto_document_summary" text,
	"auto_fact_summary" text,
	"critical_point_summary" text,
	"main_legal_axis" text,
	"secondary_risks" text,
	"proof_risks" text,
	"missing_information" text,
	"missing_documents" text,
	"opponent_initial_arguments" text,
	"approved_by_lawyer" boolean DEFAULT false NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_briefings" ADD CONSTRAINT "case_briefings_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_briefings" ADD CONSTRAINT "case_briefings_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_intake_profiles" ADD CONSTRAINT "case_intake_profiles_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_intake_profiles" ADD CONSTRAINT "case_intake_profiles_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_briefings_case_idx" ON "case_briefings" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "case_intake_profiles_case_idx" ON "case_intake_profiles" USING btree ("case_id");