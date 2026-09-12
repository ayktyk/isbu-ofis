import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { loadCaseTracking } from '../src/utils/caseTrackingLoader.js'

describe('tracking loader — no database connection', () => {
  it('does not query an empty page', async () => {
    const select = () => { throw new Error('Empty page must not query') }
    assert.deepEqual(await loadCaseTracking({ select } as unknown as Parameters<typeof loadCaseTracking>[0], 'owner-a', []), {})
  })
  for (const count of [1, 20]) it(`uses four owner-scoped batch reads for ${count} cases`, async () => {
    const conditions: SQL[] = []
    const ids = Array.from({ length: count }, (_, i) => `case-${i}`)
    let reads = 0
    const select = () => {
      reads++
      return { from: () => ({ innerJoin: () => ({ where: (condition: SQL) => {
        conditions.push(condition)
        return Promise.resolve([])
      } }) }) }
    }
    const summary = await loadCaseTracking({ select } as unknown as Parameters<typeof loadCaseTracking>[0], 'owner-a', ids)
    assert.deepEqual(Object.keys(summary), ids)
    assert.equal(reads, 4)
    for (const condition of conditions) {
      const query = new PgDialect().sqlToQuery(condition)
      assert.ok(query.sql.includes('"cases"."user_id"'))
      assert.ok(query.sql.includes('"cases"."archived_at" is null'))
      assert.ok(query.params.includes('owner-a'))
      for (const id of ids) assert.ok(query.params.includes(id))
    }
  })
})
