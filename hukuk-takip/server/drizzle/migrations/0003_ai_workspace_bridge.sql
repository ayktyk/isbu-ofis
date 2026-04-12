ALTER TABLE "cases" ADD COLUMN "automation_case_code" varchar(120);--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "automation_status" varchar(32) DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "drive_folder_path" varchar(1000);--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "briefing_path" varchar(1000);--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "procedure_path" varchar(1000);--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "research_path" varchar(1000);--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "defense_simulation_path" varchar(1000);--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "revision_path" varchar(1000);--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "pleading_md_path" varchar(1000);--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "pleading_udf_path" varchar(1000);--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."automation_status" AS ENUM(
    'not_started',
    'folder_ready',
    'briefing_ready',
    'research_ready',
    'draft_ready',
    'review_ready',
    'completed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "cases"
  ALTER COLUMN "automation_status" DROP DEFAULT;--> statement-breakpoint

ALTER TABLE "cases"
  ALTER COLUMN "automation_status" TYPE "public"."automation_status"
  USING "automation_status"::"public"."automation_status";--> statement-breakpoint

ALTER TABLE "cases"
  ALTER COLUMN "automation_status" SET DEFAULT 'not_started';--> statement-breakpoint
