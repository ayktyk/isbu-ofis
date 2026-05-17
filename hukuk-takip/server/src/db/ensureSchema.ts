import postgres from 'postgres'

// Idempotent schema guard — runs on server startup to ensure required tables exist.
// Safe to run on every boot because all statements use IF NOT EXISTS / DO $ blocks.

const CONSULTATIONS_SQL = `
DO $$ BEGIN
  CREATE TYPE "consultation_type" AS ENUM ('phone', 'in_person');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "consultation_status" AS ENUM ('pending', 'converted', 'declined');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "consultation_source" AS ENUM ('client_referral', 'past_client', 'google', 'website', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "consultations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "consultation_date" timestamp NOT NULL,
  "full_name" varchar(255) NOT NULL,
  "phone" varchar(20),
  "type" "consultation_type" NOT NULL DEFAULT 'phone',
  "subject" varchar(500),
  "notes" text,
  "status" "consultation_status" NOT NULL DEFAULT 'pending',
  "source" "consultation_source",
  "referred_by_client_id" uuid REFERENCES "clients"("id") ON DELETE SET NULL,
  "next_action_date" date,
  "converted_client_id" uuid REFERENCES "clients"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "consultations_user_idx" ON "consultations" ("user_id");
CREATE INDEX IF NOT EXISTS "consultations_date_idx" ON "consultations" ("consultation_date");
CREATE INDEX IF NOT EXISTS "consultations_status_idx" ON "consultations" ("status");

-- Yeni enum değerleri (veri kaybı yok, sadece ekleme)
DO $$ BEGIN
  ALTER TYPE "consultation_status" ADD VALUE IF NOT EXISTS 'potential';
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "consultation_source" ADD VALUE IF NOT EXISTS 'friend';
EXCEPTION WHEN others THEN null;
END $$;

-- Yeni kolonlar (idempotent)
ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "source_detail" varchar(255);
ALTER TABLE "mediation_parties" ADD COLUMN IF NOT EXISTS "lawyer_phone" varchar(20);
`

// rev2 (2026-04): Polimorfik collections + arabuluculuk anlaşılan ücret.
// TAM ADDITIVE — hiçbir kolon drop edilmez, hiçbir satır silinmez.
// case_id ve client_id NOT NULL → nullable olur (mevcut satırlar etkilenmez).
// mediation_file_id, user_id eklenir (user_id backfill edilir).
// mediation_files'a agreed_fee + currency eklenir.
const REV2_COLLECTIONS_POLY_SQL = `
-- mediation_files: anlaşılan ücret + para birimi
ALTER TABLE "mediation_files" ADD COLUMN IF NOT EXISTS "agreed_fee" numeric(12,2);
ALTER TABLE "mediation_files" ADD COLUMN IF NOT EXISTS "currency" varchar(3) NOT NULL DEFAULT 'TRY';

-- collections: polimorfik hale getir
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "mediation_file_id" uuid;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "user_id" uuid;

-- FK (mediation_file_id → mediation_files.id). Idempotent.
DO $$ BEGIN
  ALTER TABLE "collections"
    ADD CONSTRAINT "collections_mediation_file_id_fk"
    FOREIGN KEY ("mediation_file_id") REFERENCES "mediation_files"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- FK (user_id → users.id). Idempotent.
DO $$ BEGIN
  ALTER TABLE "collections"
    ADD CONSTRAINT "collections_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- user_id backfill (mevcut satırlarda eksikse case.user_id'den al)
UPDATE "collections" c
SET "user_id" = (SELECT "user_id" FROM "cases" WHERE "id" = c."case_id")
WHERE c."user_id" IS NULL AND c."case_id" IS NOT NULL;

-- Index'ler
CREATE INDEX IF NOT EXISTS "collections_mediation_idx" ON "collections" ("mediation_file_id");
CREATE INDEX IF NOT EXISTS "collections_user_idx" ON "collections" ("user_id");

-- NOT NULL kısıtlarını kaldır (polimorfik için)
ALTER TABLE "collections" ALTER COLUMN "case_id" DROP NOT NULL;
ALTER TABLE "collections" ALTER COLUMN "client_id" DROP NOT NULL;

-- XOR check constraint: case_id veya mediation_file_id dolu olmalı (ikisi birden OLAMAZ)
DO $$ BEGIN
  ALTER TABLE "collections"
    ADD CONSTRAINT "collections_source_check"
    CHECK (
      ("case_id" IS NOT NULL AND "mediation_file_id" IS NULL) OR
      ("case_id" IS NULL AND "mediation_file_id" IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN null;
WHEN check_violation THEN
  -- Mevcut veri uyumsuzsa (neredeyse imkansız ama) log'la, yine de boot'u engelle
  RAISE NOTICE 'collections_source_check: mevcut veri uyumsuz, constraint eklenmedi';
END $$;
`

// rev3 (2026-04): notifications.dismissed_at kolonu — kullanici "sil" dedi diye
// DB'den satir atmak yerine soft-delete isaretleyelim. Scanner yine ayni
// related_id uzerinden onu gorur (dismissed da olsa) ve yeniden yaratmaz;
// kullanici arayuzde listeden temizlenir. Hic veri kaybi yok.
const REV3_NOTIFICATIONS_DISMISS_SQL = `
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dismissed_at" timestamp;
CREATE INDEX IF NOT EXISTS "notifications_dismissed_idx" ON "notifications" ("dismissed_at");
`

// rev4 (2026-04): unaccent extension — arama Turkce karakter duyarli olsun
// (İ/ı, ş, ç, ğ, ö, ü normalize). CREATE EXTENSION SALT EKLER, hicbir veri
// silmez. Superuser yetkisi gerekebilir; managed Postgres'lerde (Neon, Supabase,
// Render) genelde izin verilir. Hata alirsa log'lanir, arama lower()+ilike
// fallback'e otomatik duser (route tarafinda try/catch ile).
const SEARCH_EXTENSIONS_SQL = `
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS unaccent;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'unaccent extension yuklenemedi (insufficient_privilege); arama lower()+ilike fallback kullanacak.';
WHEN undefined_file THEN
  RAISE NOTICE 'unaccent extension paketi sunucuda yok; arama lower()+ilike fallback kullanacak.';
END $$;
`

// rev5 (2026-05): Süreli işler — tasks tablosuna additive 10 kolon + 2 indeks.
// Mevcut tasks satırları is_deadline=false default ile çalışmaya devam eder.
// Hiçbir kolon silinmez/yeniden adlandırılmaz. Hiçbir satır silinmez.
// Bu blok idempotenttir — her boot'ta güvenle çalışır.
const REV5_LEGAL_DEADLINES_SQL = `
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
`

// rev6 (2026-05): notification_type enum'a 'legal_deadline_critical' değeri.
// ALTER TYPE ... ADD VALUE IF NOT EXISTS Postgres 12+ ile idempotent ve güvenli.
// Mevcut bildirimler etkilenmez. Yeni süreli iş bildirimleri bu type ile yazılır.
const REV6_NOTIFICATION_LEGAL_DEADLINE_SQL = `
DO $$ BEGIN
  ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'legal_deadline_critical';
EXCEPTION WHEN others THEN null;
END $$;
`

// rev7 (2026-05): Kullanici "sil" dediginde satirlar DB'den atilmasin.
// Bu kolonlar sadece arayuzden gizleme/arsivleme icin kullanilir; mevcut veri
// aynen kalir. Tablolarin FK/cascade davranislari degistirilmez, cunku route'lar
// hard delete yerine archived_at set edecek.
const REV7_ARCHIVE_COLUMNS_SQL = `
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "case_hearings" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "mediation_files" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "mediation_parties" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;

CREATE INDEX IF NOT EXISTS "clients_archived_idx" ON "clients" ("archived_at");
CREATE INDEX IF NOT EXISTS "cases_archived_idx" ON "cases" ("archived_at");
CREATE INDEX IF NOT EXISTS "case_hearings_archived_idx" ON "case_hearings" ("archived_at");
CREATE INDEX IF NOT EXISTS "tasks_archived_idx" ON "tasks" ("archived_at");
CREATE INDEX IF NOT EXISTS "expenses_archived_idx" ON "expenses" ("archived_at");
CREATE INDEX IF NOT EXISTS "collections_archived_idx" ON "collections" ("archived_at");
CREATE INDEX IF NOT EXISTS "documents_archived_idx" ON "documents" ("archived_at");
CREATE INDEX IF NOT EXISTS "notes_archived_idx" ON "notes" ("archived_at");
CREATE INDEX IF NOT EXISTS "mediation_files_archived_idx" ON "mediation_files" ("archived_at");
CREATE INDEX IF NOT EXISTS "mediation_parties_archived_idx" ON "mediation_parties" ("archived_at");
CREATE INDEX IF NOT EXISTS "consultations_archived_idx" ON "consultations" ("archived_at");
`

// rev8 (2026-05): Dava günlüğü — manuel girdiler + otomatik aktivite olayları.
// Her girdi (manuel veya otomatik) içinde "sonraki adım" alanı tutulabilir.
// TAM ADDITIVE: hiçbir mevcut tablo değişmez. Sadece yeni enum + tablo + indeks.
const REV8_CASE_DIARY_SQL = `
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
`

// rev9 (2026-05): CMK görevlendirmesi ayrımı. Cases tablosuna additive boolean kolon.
// "CMK" ile başlayan davalar UI'da ayrı sayfada listelenir; tahsilat raporu CMK
// gelirini ayrı gösterir. Mevcut satırlar default false alır (veri değişmez).
const REV9_CMK_ASSIGNMENT_SQL = `
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "is_cmk_assignment" boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "cases_cmk_idx" ON "cases" ("user_id", "is_cmk_assignment");
`

export async function ensureSchema() {
  if (!process.env.DATABASE_URL) {
    console.warn('ensureSchema: DATABASE_URL yok, atlaniyor.')
    return
  }
  const sql = postgres(process.env.DATABASE_URL)
  try {
    await sql.unsafe(CONSULTATIONS_SQL)
    console.log('Schema guard: consultations hazir.')
    await sql.unsafe(REV2_COLLECTIONS_POLY_SQL)
    console.log('Schema guard: polimorfik collections + mediation agreed_fee hazir.')
    await sql.unsafe(REV3_NOTIFICATIONS_DISMISS_SQL)
    console.log('Schema guard: notifications.dismissed_at hazir.')
    await sql.unsafe(SEARCH_EXTENSIONS_SQL)
    console.log('Schema guard: unaccent extension hazir (veya bilgilendirici notice).')
    await sql.unsafe(REV5_LEGAL_DEADLINES_SQL)
    console.log('Schema guard: tasks süreli iş kolonları hazir.')
    await sql.unsafe(REV6_NOTIFICATION_LEGAL_DEADLINE_SQL)
    console.log('Schema guard: notification_type legal_deadline_critical hazir.')
    await sql.unsafe(REV7_ARCHIVE_COLUMNS_SQL)
    console.log('Schema guard: arsivleme kolonlari hazir.')
    await sql.unsafe(REV8_CASE_DIARY_SQL)
    console.log('Schema guard: dava gunlugu (case_diary_entries) hazir.')
    await sql.unsafe(REV9_CMK_ASSIGNMENT_SQL)
    console.log('Schema guard: cases.is_cmk_assignment hazir.')
  } catch (err) {
    console.error('Schema guard hatasi:', err)
  } finally {
    await sql.end({ timeout: 5 })
  }
}
