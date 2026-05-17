-- 0014: cases.is_cmk_assignment — CMK görevlendirmesi (Ceza Muhakemesi Kanunu)
-- ayrımı için additive kolon. Hiçbir mevcut kayıt değişmez; default false.
-- ensureSchema REV9 her boot'ta idempotent uygular.

ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "is_cmk_assignment" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "cases_cmk_idx" ON "cases" ("user_id", "is_cmk_assignment");
