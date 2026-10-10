-- rev15: integration_events.details->>'request_id' ifade indeksi (yalniz ekleme).
-- Kaynak: server/src/db/ensureSchema.ts -> REV15_INTEGRATION_SQL (sunucu acilisinda idempotent calisir).
-- 0013/0014/0015 gibi elle yazildi, drizzle journal disinda.
CREATE INDEX IF NOT EXISTS "integration_events_request_id_idx"
  ON "integration_events" ((details->>'request_id'))
  WHERE (details->>'request_id') IS NOT NULL;
