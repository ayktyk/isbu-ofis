ALTER TYPE "public"."case_status" ADD VALUE 'istinafta' BEFORE 'passive';--> statement-breakpoint
ALTER TYPE "public"."case_status" ADD VALUE 'yargıtayda' BEFORE 'passive';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "label" varchar(100);