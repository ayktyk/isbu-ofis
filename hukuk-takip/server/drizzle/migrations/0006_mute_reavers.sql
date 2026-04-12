CREATE TYPE "public"."research_run_status" AS ENUM('idle', 'running', 'completed', 'partial', 'failed');--> statement-breakpoint
CREATE TABLE "case_research_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"research_question" text,
	"search_keywords" text,
	"use_notebooklm" boolean DEFAULT false NOT NULL,
	"notebooklm_notebook" varchar(500),
	"notebooklm_question" text,
	"use_vector_db" boolean DEFAULT false NOT NULL,
	"vector_collections" text,
	"vector_query" text,
	"vector_top_k" integer DEFAULT 5 NOT NULL,
	"use_yargi_mcp" boolean DEFAULT true NOT NULL,
	"yargi_query" text,
	"yargi_court_types" varchar(500),
	"yargi_chamber" varchar(50),
	"yargi_date_start" date,
	"yargi_date_end" date,
	"yargi_result_limit" integer DEFAULT 5 NOT NULL,
	"use_mevzuat_mcp" boolean DEFAULT true NOT NULL,
	"mevzuat_query" text,
	"mevzuat_scope" text,
	"mevzuat_law_numbers" varchar(500),
	"mevzuat_result_limit" integer DEFAULT 5 NOT NULL,
	"last_run_at" timestamp,
	"last_run_status" "research_run_status" DEFAULT 'idle' NOT NULL,
	"last_run_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_research_profiles" ADD CONSTRAINT "case_research_profiles_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_research_profiles_case_idx" ON "case_research_profiles" USING btree ("case_id");