// ensureSchema()'yi tek seferlik calistirir.
//
// Neden ayri script: sema degisiklikleri normalde sunucu boot'unda uygulanir.
// Gelistirme sirasinda sunucuyu ayaga kaldirmadan (ve cron/bildirim taramasini
// tetiklemeden) yalnizca sema guard'ini calistirmak icin.
//
// ensureSchema icindeki TUM ifadeler idempotent ve additive'dir
// (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS). Veri silmez.
//
// Kullanim:
//   cd server && npx tsx --env-file=../.env scripts/apply-schema.ts
import '../src/env.js'
import { ensureSchema } from '../src/db/ensureSchema.js'

await ensureSchema()
console.log('Sema guard tamamlandi.')
process.exit(0)
