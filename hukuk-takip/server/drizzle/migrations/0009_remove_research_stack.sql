ALTER TABLE "cases" DROP COLUMN IF EXISTS "automation_case_code";
ALTER TABLE "cases" DROP COLUMN IF EXISTS "automation_status";
ALTER TABLE "cases" DROP COLUMN IF EXISTS "drive_folder_path";
ALTER TABLE "cases" DROP COLUMN IF EXISTS "briefing_path";
ALTER TABLE "cases" DROP COLUMN IF EXISTS "procedure_path";
ALTER TABLE "cases" DROP COLUMN IF EXISTS "research_path";
ALTER TABLE "cases" DROP COLUMN IF EXISTS "defense_simulation_path";
ALTER TABLE "cases" DROP COLUMN IF EXISTS "revision_path";
ALTER TABLE "cases" DROP COLUMN IF EXISTS "pleading_md_path";
ALTER TABLE "cases" DROP COLUMN IF EXISTS "pleading_udf_path";

DROP TABLE IF EXISTS "ai_job_sources" CASCADE;
DROP TABLE IF EXISTS "ai_job_reviews" CASCADE;
DROP TABLE IF EXISTS "ai_job_artifacts" CASCADE;
DROP TABLE IF EXISTS "ai_job_steps" CASCADE;
DROP TABLE IF EXISTS "ai_jobs" CASCADE;
DROP TABLE IF EXISTS "case_procedure_reports" CASCADE;
DROP TABLE IF EXISTS "case_research_profiles" CASCADE;
DROP TABLE IF EXISTS "case_briefings" CASCADE;
DROP TABLE IF EXISTS "case_intake_profiles" CASCADE;

DROP TYPE IF EXISTS "public"."automation_status";
DROP TYPE IF EXISTS "public"."ai_job_status";
DROP TYPE IF EXISTS "public"."ai_job_step_status";
DROP TYPE IF EXISTS "public"."ai_review_status";
DROP TYPE IF EXISTS "public"."briefing_status";
DROP TYPE IF EXISTS "public"."research_run_status";
DROP TYPE IF EXISTS "public"."procedure_status";
