// Only this newly created, loopback-only temporary database is writable in tests.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
const receipt = JSON.parse(readFileSync(new URL('../../backups/pre-case-tracking-2026-09-11T23-36-13-696Z.dump.receipt.json', import.meta.url)))
const backup = readFileSync(new URL(`../../backups/${receipt.file}`, import.meta.url))
if (createHash('sha256').update(backup).digest('hex') !== receipt.sha256) throw new Error('Backup checksum mismatch')
function run(args, input) { const r = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, timeout: 120000 }); if (r.status !== 0) throw new Error(r.stderr || r.error?.message || 'Docker check failed'); return r.stdout.trim() }
const directory = fileURLToPath(new URL('../../backups/', import.meta.url))
const password = randomUUID()
const container = run(['run', '-d', '--rm', '--label', 'com.hukuktakip.purpose=workspace-test', '--tmpfs', '/var/lib/postgresql/data:rw', '-p', '127.0.0.1::5432', '--mount', `type=bind,source=${directory},target=/backup,readonly`, '-e', `POSTGRES_PASSWORD=${password}`, 'postgres:17-alpine'])
if (!/^[a-f0-9]{64}$/.test(container)) throw new Error('Invalid temporary container')
try {
  for (let n = 0; ; n++) { const r = spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], { windowsHide: true }); if (r.status === 0) break; if (n > 30) throw new Error('Temporary database not ready'); await new Promise(r => setTimeout(r, 1000)) }
  run(['exec', container, 'pg_restore', '--exit-on-error', '--no-owner', '--no-privileges', '-U', 'postgres', '-d', 'postgres', `/backup/${receipt.file}`])
  run(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], readFileSync(new URL('../src/db/workspace-additive.sql', import.meta.url), 'utf8'))
  const port = run(['port', container, '5432/tcp']).match(/^127\.0\.0\.1:(\d+)$/)?.[1]
  if (!port) throw new Error('Expected loopback-only database port')
  const result = spawnSync(process.execPath, ['--import=tsx', '--test', 'review/workspace.integration.ts'], { cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env, DATABASE_URL: `postgres://postgres:${password}@127.0.0.1:${port}/postgres`, JWT_SECRET: randomUUID(), WORKSPACE_ISOLATED_TEST: '1' }, encoding: 'utf8', windowsHide: true, timeout: 120000 })
  console.log(result.stdout)
  if (result.status !== 0) { console.error('Isolated integration tests failed.'); process.exitCode = 1 }
} finally { run(['stop', container]) }
