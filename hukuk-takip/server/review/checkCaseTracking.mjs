// Checks the new loader inside a database-enforced READ ONLY transaction.
// No server startup import, migrations, or personal data printed.
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { loadCaseTracking } from '../dist/utils/caseTrackingLoader.js'

const env = parse(readFileSync(new URL('../../.env', import.meta.url)))
const url = new URL(env.DATABASE_URL)
if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace(/-pooler\./, '.')
const client = postgres(url.toString(), { max: 1, prepare: false, connect_timeout: 30, onnotice: () => {} })
try {
  const result = await drizzle(client).transaction(async database => {
    await database.execute(sql`SET LOCAL statement_timeout = '20s'`)
    const owners = await database.execute(sql`SELECT DISTINCT user_id FROM cases WHERE archived_at IS NULL`)
    let checked = 0
    for (const owner of owners) {
      const rows = await database.execute(sql`SELECT id FROM cases WHERE user_id = ${owner.user_id} AND archived_at IS NULL ORDER BY id LIMIT 20`)
      const ids = rows.map(row => row.id)
      const tracking = await loadCaseTracking(database, owner.user_id, ids)
      if (Object.keys(tracking).length !== ids.length) throw new Error('Summary coverage mismatch')
      for (const value of Object.values(tracking)) {
        if (value.deadlineCount > value.openCount || value.overdueCount > value.openCount) throw new Error('Invalid summary counts')
      }
      const foreign = await loadCaseTracking(database, '00000000-0000-0000-0000-000000000000', ids)
      if (Object.values(foreign).some(value => value.openCount || value.nextHearing || value.lastDevelopment)) throw new Error('Ownership isolation failed')
      checked += ids.length
    }
    return { readOnly: true, ownersChecked: owners.length, casesChecked: checked, ownershipIsolation: true }
  }, { accessMode: 'read only' })
  console.log(JSON.stringify(result))
} catch (error) {
  let message = error.message || 'Read-only check failed'
  for (const secret of [env.DATABASE_URL, url.hostname, decodeURIComponent(url.username), decodeURIComponent(url.password)]) if (secret) message = message.split(secret).join('[redacted]')
  console.error(JSON.stringify({ checkFailed: true, code: error.code || error.name, message }))
  process.exitCode = 1
} finally {
  await client.end({ timeout: 5 })
}
