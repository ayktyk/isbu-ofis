// Explicit manual additive migration, never imported by startup/deployment.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parse } from 'dotenv'
import postgres from 'postgres'
const receiptName = process.argv[2]
if (!/^pre-case-tracking-[\dTZ-]+\.dump\.receipt\.json$/.test(receiptName || '')) throw new Error('Verified backup receipt required')
const receipt = JSON.parse(readFileSync(new URL(`../../backups/${receiptName}`, import.meta.url)))
const backup = readFileSync(new URL(`../../backups/${receipt.file}`, import.meta.url))
if (!receipt.restoreVerified || createHash('sha256').update(backup).digest('hex') !== receipt.sha256) throw new Error('Backup verification required')
const migration = readFileSync(new URL('../src/db/workspace-additive.sql', import.meta.url), 'utf8')
if (/\b(DROP|DELETE|TRUNCATE|ALTER|UPDATE|INSERT)\b/i.test(migration.replace(/ON DELETE RESTRICT/g, ''))) throw new Error('Only CREATE TABLE migration is allowed')
const env = parse(readFileSync(new URL('../../.env', import.meta.url)))
const url = new URL(env.DATABASE_URL)
if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace(/-pooler\./, '.')
const client = postgres(url.toString(), { max: 1, prepare: false, connect_timeout: 30, onnotice: () => {} })
try {
  const result = await client.begin(async tx => {
    await tx`SET LOCAL lock_timeout = '5s'`
    await tx`SET LOCAL statement_timeout = '30s'`
    const [before] = await tx`SELECT (SELECT count(*)::int FROM cases) AS cases, (SELECT count(*)::int FROM clients) AS clients`
    await tx.unsafe(migration)
    const [after] = await tx`SELECT (SELECT count(*)::int FROM cases) AS cases, (SELECT count(*)::int FROM clients) AS clients`
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Record counts changed during migration')
    return { before, after, tables: ['case_workspaces', 'hearing_review_receipts'] }
  })
  const report = { appliedAt: new Date().toISOString(), backupReceipt: receiptName, migrationSha256: createHash('sha256').update(migration).digest('hex'), ...result }
  writeFileSync(new URL(`../../backups/workspace-migration-${Date.now()}.json`, import.meta.url), JSON.stringify(report, null, 2), { flag: 'wx' })
  console.log(JSON.stringify(report))
} catch (error) { console.error(JSON.stringify({ migrationFailed: true, code: error.code || error.name })); process.exitCode = 1 }
finally { await client.end({ timeout: 5 }) }
