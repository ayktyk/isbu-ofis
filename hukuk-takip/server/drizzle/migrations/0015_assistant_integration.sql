-- 0015: Asistan entegrasyonu (rev14) — api_keys, assistant_proposals,
-- integration_events, case_enforcement + mevcut tablolara external_ref /
-- buro_kodu / updated_by_actor kolonları.
-- Bu migration TAM ADDITIVE'tir: hiçbir tablo/kolon silinmez, hiçbir satır
-- silinmez. Mevcut satırlar yalnızca updated_by_actor DEFAULT 'avukat' alır.
-- ensureSchema.ts içindeki REV14_INTEGRATION_SQL bloğu aynı işi her boot'ta
-- idempotent olarak yapar (0013/0014 ile aynı desen; drizzle journal'a eklenmez).
-- Uygulamadan ÖNCE: pg_dump yedeği + backups/README.md notu (CLAUDE.md).

-- Mevcut tablolara nullable / default'lu kolonlar (mevcut satırlar 'avukat' alır).
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "buro_kodu" varchar(20);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "external_ref" varchar(200);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "updated_by_actor" varchar(20) NOT NULL DEFAULT 'avukat';
ALTER TABLE "case_hearings" ADD COLUMN IF NOT EXISTS "external_ref" varchar(200);
ALTER TABLE "case_hearings" ADD COLUMN IF NOT EXISTS "updated_by_actor" varchar(20) NOT NULL DEFAULT 'avukat';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "external_ref" varchar(200);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "updated_by_actor" varchar(20) NOT NULL DEFAULT 'avukat';
ALTER TABLE "case_diary_entries" ADD COLUMN IF NOT EXISTS "external_ref" varchar(200);
ALTER TABLE "case_diary_entries" ADD COLUMN IF NOT EXISTS "updated_by_actor" varchar(20) NOT NULL DEFAULT 'avukat';
ALTER TABLE "mediation_files" ADD COLUMN IF NOT EXISTS "external_ref" varchar(200);

-- Dış anahtar tekilliği yalnızca dolu satırlarda (mevcut satırlar NULL → çakışma yok).
CREATE UNIQUE INDEX IF NOT EXISTS "cases_user_external_ref_uidx" ON "cases" ("user_id", "external_ref") WHERE external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS "cases_user_buro_kodu_idx" ON "cases" ("user_id", "buro_kodu");
CREATE UNIQUE INDEX IF NOT EXISTS "case_hearings_case_external_ref_uidx" ON "case_hearings" ("case_id", "external_ref") WHERE external_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_user_external_ref_uidx" ON "tasks" ("user_id", "external_ref") WHERE external_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "case_diary_case_external_ref_uidx" ON "case_diary_entries" ("case_id", "external_ref") WHERE external_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "mediation_files_user_external_ref_uidx" ON "mediation_files" ("user_id", "external_ref") WHERE external_ref IS NOT NULL;

-- API anahtarları (yalnız sha256 özeti saklanır).
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "name" varchar(100) NOT NULL,
  "key_prefix" varchar(32) NOT NULL,
  "key_hash" varchar(64) NOT NULL,
  "scopes" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "last_used_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "revoked_at" timestamp
);
CREATE INDEX IF NOT EXISTS "api_keys_user_idx" ON "api_keys" ("user_id");
CREATE INDEX IF NOT EXISTS "api_keys_prefix_idx" ON "api_keys" ("key_prefix");
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_hash_uidx" ON "api_keys" ("key_hash");

-- Asistan önerileri (avukat onayı bekleyen değişiklikler).
CREATE TABLE IF NOT EXISTS "assistant_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "kind" varchar(40) NOT NULL,
  "case_id" uuid REFERENCES "cases"("id") ON DELETE RESTRICT,
  "case_ref" jsonb,
  "target_type" varchar(40),
  "target_id" uuid,
  "external_ref" varchar(200) NOT NULL,
  "payload" jsonb NOT NULL,
  "before" jsonb,
  "conflict" boolean NOT NULL DEFAULT false,
  "summary" text NOT NULL,
  "reason" text,
  "source" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "request_id" varchar(100) NOT NULL,
  "api_key_id" uuid REFERENCES "api_keys"("id") ON DELETE RESTRICT,
  "decided_note" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "decided_at" timestamp,
  "applied_at" timestamp,
  "applied_target_id" uuid,
  "error" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_proposals_request_uidx" ON "assistant_proposals" ("request_id");
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_proposals_pending_uidx" ON "assistant_proposals" ("user_id", "kind", "external_ref") WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS "assistant_proposals_user_status_idx" ON "assistant_proposals" ("user_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "assistant_proposals_case_idx" ON "assistant_proposals" ("case_id");

-- Denetim izi: asistan ve avukatın entegrasyon üzerinden yaptığı her işlem.
CREATE TABLE IF NOT EXISTS "integration_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "actor" varchar(20) NOT NULL,
  "api_key_id" uuid REFERENCES "api_keys"("id") ON DELETE RESTRICT,
  "action" varchar(60) NOT NULL,
  "target_type" varchar(40),
  "target_id" uuid,
  "proposal_id" uuid REFERENCES "assistant_proposals"("id") ON DELETE RESTRICT,
  "details" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "integration_events_user_created_idx" ON "integration_events" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "integration_events_proposal_idx" ON "integration_events" ("proposal_id");

-- İcra dosyası özeti (dava başına tek satır).
CREATE TABLE IF NOT EXISTS "case_enforcement" (
  "case_id" uuid PRIMARY KEY REFERENCES "cases"("id") ON DELETE RESTRICT,
  "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "source_ref" varchar(200),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "updated_by_actor" varchar(20) NOT NULL DEFAULT 'asistan'
);
