-- 0013: Dava günlüğü — case_diary_entries tablosu + diary_entry_type enum.
-- Bu migration TAM ADDITIVE'tir: hiçbir mevcut tablo/kolon değişmez,
-- hiçbir satır silinmez. Sadece yeni enum + yeni tablo + 3 indeks oluşturulur.
-- Ek olarak ensureSchema.ts içindeki REV8 bloğu bu işi her boot'ta da yapar.

DO $$ BEGIN
  CREATE TYPE "diary_entry_type" AS ENUM (
    'manual',
    'hearing_added',
    'hearing_updated',
    'hearing_completed',
    'task_added',
    'task_completed',
    'expense_added',
    'collection_added',
    'document_added',
    'status_changed',
    'note_added'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "case_diary_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "case_id" uuid NOT NULL REFERENCES "cases"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "entry_type" "diary_entry_type" NOT NULL DEFAULT 'manual',
  "title" varchar(255),
  "content" text,
  "next_step" text,
  "next_step_due_date" date,
  "next_step_done" boolean NOT NULL DEFAULT false,
  "occurred_at" timestamp NOT NULL DEFAULT now(),
  "linked_entity_type" varchar(32),
  "linked_entity_id" uuid,
  "archived_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "case_diary_case_idx" ON "case_diary_entries" ("case_id");
CREATE INDEX IF NOT EXISTS "case_diary_occurred_idx" ON "case_diary_entries" ("occurred_at");
CREATE INDEX IF NOT EXISTS "case_diary_next_step_open_idx" ON "case_diary_entries" ("case_id", "next_step_done");
