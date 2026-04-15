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

export async function ensureSchema() {
  if (!process.env.DATABASE_URL) {
    console.warn('ensureSchema: DATABASE_URL yok, atlaniyor.')
    return
  }
  const sql = postgres(process.env.DATABASE_URL)
  try {
    await sql.unsafe(CONSULTATIONS_SQL)
    console.log('Schema guard: consultations hazir.')
  } catch (err) {
    console.error('Schema guard hatasi:', err)
  } finally {
    await sql.end({ timeout: 5 })
  }
}
