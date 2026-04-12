CREATE TYPE "public"."procedure_status" AS ENUM('not_started', 'precheck_done', 'generating', 'draft', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "case_procedure_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"court_type" varchar(255),
	"jurisdiction" varchar(500),
	"arbitration_required" boolean,
	"arbitration_basis" varchar(500),
	"statute_of_limitations" text,
	"court_fees" text,
	"special_power_of_attorney" boolean,
	"special_power_of_attorney_note" text,
	"precheck_passed" boolean DEFAULT false NOT NULL,
	"precheck_notes" text,
	"report_markdown" text,
	"storage_path" varchar(1000),
	"status" "procedure_status" DEFAULT 'not_started' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"rejection_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_procedure_reports" ADD CONSTRAINT "case_procedure_reports_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_procedure_reports" ADD CONSTRAINT "case_procedure_reports_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_procedure_reports_case_idx" ON "case_procedure_reports" USING btree ("case_id");