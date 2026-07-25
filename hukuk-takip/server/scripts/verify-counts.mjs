// Salt-okunur dogrulama: kritik tablolarin satir sayilari ve yeni kolonlarin
// varligi. Sema degisikligi sonrasi "veri kaybi olmadi" kontrolu icin.
//
// SADECE SELECT calistirir.
//
// Kullanim: node --env-file=../.env scripts/verify-counts.mjs
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL_MIGRATION || process.env.DATABASE_URL, { max: 1 })

const TABLES = [
  'cases',
  'clients',
  'tasks',
  'collections',
  'mediation_files',
  'mediation_parties',
  'consultations',
  'case_hearings',
  'case_diary_entries',
  'notifications',
  'notes',
  'users',
]

try {
  console.log('--- Satir sayilari ---')
  for (const table of TABLES) {
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM ${sql(table)}`
    console.log(`${table.padEnd(22)} ${n}`)
  }

  console.log('\n--- Yeni kolonlar ---')
  const cols = await sql`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE (table_name = 'tasks' AND column_name = 'category')
       OR (table_name = 'cases' AND column_name LIKE 'fee%')
    ORDER BY table_name, column_name
  `
  if (cols.length === 0) console.log('(henuz yok)')
  for (const c of cols) {
    console.log(`${c.table_name}.${c.column_name.padEnd(22)} ${c.data_type} nullable=${c.is_nullable}`)
  }

  const [inst] = await sql`
    SELECT count(*)::int AS n FROM information_schema.tables
    WHERE table_name = 'case_fee_installments'
  `
  console.log(`\ncase_fee_installments tablosu: ${inst.n === 1 ? 'VAR' : 'YOK'}`)
} catch (err) {
  console.error('HATA:', err.message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
