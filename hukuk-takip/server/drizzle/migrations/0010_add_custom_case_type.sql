ALTER TABLE "cases"
ADD COLUMN IF NOT EXISTS "custom_case_type" varchar(255);
