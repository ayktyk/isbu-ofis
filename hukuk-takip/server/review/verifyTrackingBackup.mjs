// Restores only into a new, isolated, disposable container. No production credentials.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'

const receiptName = process.argv[2]
if (!/^pre-case-tracking-[\dTZ-]+\.dump\.receipt\.json$/.test(receiptName || '')) throw new Error('Invalid receipt filename')
const receiptUrl = new URL(`../../backups/${receiptName}`, import.meta.url)
const receipt = JSON.parse(readFileSync(receiptUrl, 'utf8'))
if (!/^pre-case-tracking-[\dTZ-]+\.dump$/.test(receipt.file) || !/^postgres:\d+-alpine$/.test(receipt.clientImage)) throw new Error('Invalid backup metadata')
const backup = readFileSync(new URL(`../../backups/${receipt.file}`, import.meta.url))
if (createHash('sha256').update(backup).digest('hex') !== receipt.sha256) throw new Error('Backup checksum mismatch')
function run(args, input) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 2 * 1024 * 1024, input })
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Verification failed')
  return result.stdout.trim()
}
const directory = fileURLToPath(new URL('../../backups/', import.meta.url))
const name = `case-tracking-verify-${randomUUID()}`
const container = run(['run', '-d', '--rm', '--name', name, '--label', 'com.hukuktakip.purpose=backup-verification', '--network', 'none',
  '--tmpfs', '/var/lib/postgresql/data:rw', '--mount', `type=bind,source=${directory},target=/backup,readonly`,
  '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', receipt.clientImage])
if (!/^[a-f0-9]{64}$/.test(container)) throw new Error('Invalid verification container id')
try {
  // Short bounded retries while this newly created database initializes.
  for (let attempt = 0; ; attempt++) {
    const check = spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], { windowsHide: true, encoding: 'utf8' })
    if (check.status === 0) break
    if (attempt >= 29) throw new Error('Temporary database did not become ready')
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  run(['exec', container, 'pg_restore', '--exit-on-error', '--no-owner', '--no-privileges', '-U', 'postgres', '-d', 'postgres', `/backup/${receipt.file}`])
  const counts = run(['exec', container, 'psql', '-X', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-c',
    "SELECT json_build_object('cases',(SELECT count(*) FROM cases),'clients',(SELECT count(*) FROM clients),'tasks',(SELECT count(*) FROM tasks),'diary',(SELECT count(*) FROM case_diary_entries),'hearings',(SELECT count(*) FROM case_hearings),'notes',(SELECT count(*) FROM notes),'documents',(SELECT count(*) FROM documents),'expenses',(SELECT count(*) FROM expenses),'collections',(SELECT count(*) FROM collections))"])
  receipt.restoreVerified = true
  receipt.restoreVerifiedAt = new Date().toISOString()
  receipt.restoredCounts = JSON.parse(counts)
  writeFileSync(receiptUrl, JSON.stringify(receipt, null, 2) + '\n')
  console.log(JSON.stringify({ file: receipt.file, restoreVerified: true, restoredCounts: receipt.restoredCounts }))
} finally {
  // Only stop the exact container created above. --rm removes its temporary state;
  // no existing container, persistent volume, or backup file is touched.
  run(['stop', container])
}
