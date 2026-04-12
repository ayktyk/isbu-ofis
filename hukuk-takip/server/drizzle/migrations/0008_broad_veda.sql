ALTER TYPE "public"."procedure_status" ADD VALUE 'error';--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "custom_case_type" varchar(255);