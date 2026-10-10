import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { REV15_INTEGRATION_SQL } from '../src/db/ensureSchema.js'
import { createTestDatabase } from './helpers.js'

let ctx: Awaited<ReturnType<typeof createTestDatabase>>

beforeAll(async () => {
  ctx = await createTestDatabase()
}, 60_000)

afterAll(async () => {
  await ctx?.pg.close()
})

describe('rev15 şema (yalnız ekleme)', () => {
  it('MED5: request_id ifade indeksi idempotent kurulur ve tekrar kontrolü onu kullanır', async () => {
    await ctx.pg.exec(REV15_INTEGRATION_SQL)
    await ctx.pg.exec(REV15_INTEGRATION_SQL)
    const idx = await ctx.pg.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'integration_events_request_id_idx'`)
    expect(idx.rows).toHaveLength(1)
    expect(idx.rows[0].indexdef).toContain("request_id")

    await ctx.pg.exec('SET enable_seqscan = off')
    const plan = await ctx.pg.query<{ 'QUERY PLAN': string }>(
      `EXPLAIN SELECT user_id, proposal_id FROM integration_events
       WHERE action IN ('proposal_created','proposal_updated','proposal_no_change') AND (details->>'request_id') = 'req-12345678' LIMIT 1`
    )
    await ctx.pg.exec('RESET enable_seqscan')
    expect(plan.rows.map((r) => r['QUERY PLAN']).join('\n')).toContain('integration_events_request_id_idx')
  })

  it('REV15 SQL yıkıcı komut içermez', () => {
    expect(REV15_INTEGRATION_SQL).not.toMatch(/\b(DROP|TRUNCATE|DELETE)\b/i)
    expect(REV15_INTEGRATION_SQL).toMatch(/IF NOT EXISTS/)
  })
})
