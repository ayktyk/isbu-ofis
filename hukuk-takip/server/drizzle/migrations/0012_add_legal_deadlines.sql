-- 0012: Süreli İşler — tasks tablosuna additive kolonlar + notification_type enum genişletmesi.
-- Bu migration TAM ADDITIVE'tir: hiçbir kolon silinmez, hiçbir satır silinmez,
-- hiçbir mevcut görev kategorize edilmez (is_deadline=false default).
-- Ek olarak ensureSchema.ts içindeki REV5+REV6 blokları bu işi her boot'ta da yapar.

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "is_deadline" boolean NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deadline_template_key" varchar(80);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deadline_category" varchar(40);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deadline_severity" varchar(20);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "trigger_event_date" date;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "trigger_event_label" varchar(200);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "calculated_due_date" date;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "adjusted_for_holiday" boolean NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "legal_basis" varchar(200);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completion_evidence" text;

CREATE INDEX IF NOT EXISTS "tasks_deadline_idx" ON "tasks" ("is_deadline","due_date");
CREATE INDEX IF NOT EXISTS "tasks_user_deadline_idx" ON "tasks" ("user_id","is_deadline");

DO $$ BEGIN
  ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'legal_deadline_critical';
EXCEPTION WHEN others THEN null;
END $$;
