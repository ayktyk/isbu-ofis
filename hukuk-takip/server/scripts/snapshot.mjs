// Salt-okunur veri anlik goruntusu.
//
// Neden: sema degisikligi (ensureSchema REV*) oncesi geri donulebilir bir
// kayit birakmak icin. pg_dump her makinede kurulu olmayabiliyor; bu script
// projenin zaten kullandigi `postgres` paketiyle ayni isi JSON olarak yapar.
//
// SADECE SELECT calistirir. Hicbir INSERT/UPDATE/DELETE/ALTER icermez.
//
// Kullanim:
//   node --env-file=../.env server/scripts/snapshot.mjs <etiket>
// Cikti:
//   hukuk-takip/.local-backups/<tarih>-<etiket>.json  (gitignore'da)

import postgres from 'postgres'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', '..', '.local-backups')

const label = process.argv[2] || 'snapshot'
const url = process.env.DATABASE_URL_MIGRATION || process.env.DATABASE_URL

if (!url) {
  console.error('HATA: DATABASE_URL_MIGRATION veya DATABASE_URL tanimli degil.')
  process.exit(1)
}

const sql = postgres(url, { max: 1 })

try {
  const tables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `

  const snapshot = {}
  const counts = {}

  for (const { tablename } of tables) {
    const rows = await sql`SELECT * FROM ${sql(tablename)}`
    snapshot[tablename] = rows
    counts[tablename] = rows.length
  }

  mkdirSync(outDir, { recursive: true })

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const file = join(outDir, `${stamp}-${label}.json`)

  writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), counts, data: snapshot }, null, 2))

  console.log(`Anlik goruntu yazildi: ${file}`)
  console.log('Satir sayilari:')
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(28)} ${count}`)
  }
} catch (err) {
  console.error('Anlik goruntu HATASI:', err.message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
