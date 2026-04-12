CREATE TYPE "public"."user_role" AS ENUM('admin', 'lawyer', 'assistant');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'lawyer' NOT NULL;