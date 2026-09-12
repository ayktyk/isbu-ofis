// Standalone backup helper. Never imports server startup or runs migrations.
import { parse } from 'dotenv'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const config = parse(readFileSync(new URL('../../.env', import.meta.url)))
const connection = new URL(config.DATABASE_URL)
// Neon recommends a direct connection for pg_dump; keep the same endpoint/database.
// https://neon.com/docs/connect/connection-pooling
if (connection.hostname.endsWith('.neon.tech')) connection.hostname = connection.hostname.replace(/-pooler\./, '.')
const mode = process.argv[2] || 'check'
const image = process.argv[3] || 'postgres:16-alpine'
if (!/^postgres:\d+-alpine$/.test(image) || !['check', 'backup'].includes(mode)) throw new Error('Invalid backup arguments')
const env = {
  ...process.env,
  PGHOST: ['localhost', '127.0.0.1'].includes(connection.hostname) ? 'host.docker.internal' : connection.hostname,
  PGPORT: connection.port || '5432', PGDATABASE: decodeURIComponent(connection.pathname.slice(1)),
  PGUSER: decodeURIComponent(connection.username), PGPASSWORD: decodeURIComponent(connection.password),
  PGSSLMODE: connection.searchParams.get('sslmode') || 'require',
  PGCONNECT_TIMEOUT: '30', PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=120000',
}
const envArgs = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSSLMODE', 'PGCONNECT_TIMEOUT', 'PGOPTIONS'].flatMap(key => ['-e', key])
function run(args) {
  const result = spawnSync('docker', args, { env, encoding: 'utf8', windowsHide: true, timeout: 300000, maxBuffer: 4 * 1024 * 1024 })
  if (result.status !== 0) {
    let error = result.stderr || result.error?.message || 'Docker command failed'
    for (const key of ['PGPASSWORD', 'PGUSER', 'PGHOST', 'PGDATABASE']) if (env[key]) error = error.split(env[key]).join('[redacted]')
    throw new Error(error)
  }
  return result.stdout.trim()
}
const version = run(['run', '--rm', ...envArgs, image, 'psql', '-X', '-A', '-t', '-c', 'SHOW server_version_num'])
if (!/^\d+$/.test(version)) throw new Error('Unable to verify PostgreSQL version')
console.log(`PostgreSQL server version number: ${version}`)
if (mode === 'backup') {
  const clientMajor = Number(image.match(/:(\d+)/)[1])
  if (clientMajor < Math.floor(Number(version) / 10000)) throw new Error('A matching or newer pg_dump image is required')
  const directory = fileURLToPath(new URL('../../backups/', import.meta.url))
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const name = `pre-case-tracking-${stamp}.dump`
  const output = new URL(`../../backups/${name}`, import.meta.url)
  if (existsSync(output)) throw new Error('Backup target already exists')
  run(['run', '--rm', ...envArgs, '--mount', `type=bind,source=${directory},target=/backup`, image,
    'pg_dump', '--format=custom', '--no-owner', '--no-privileges', '--lock-wait-timeout=15000', `--file=/backup/${name}`])
  const listing = run(['run', '--rm', '--mount', `type=bind,source=${directory},target=/backup,readonly`, image, 'pg_restore', '--list', `/backup/${name}`])
  if (!listing.includes('TABLE DATA')) throw new Error('Backup archive did not contain table data')
  const bytes = readFileSync(output)
  const receipt = { file: name, createdAt: new Date().toISOString(), serverVersion: version, clientImage: image, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), archiveListVerified: true, restoreVerified: false }
  writeFileSync(new URL(`../../backups/${name}.receipt.json`, import.meta.url), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' })
  console.log(JSON.stringify(receipt))
}
