// M3: rev14/rev15 açılış DDL'i kilit beklerken sonsuza dek takılmasın (lock_timeout),
// hata loglanıp açılış sürsün ve sonraki açılışta yeniden denensin.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { applyIntegrationSchema, REV14_INTEGRATION_SQL, REV15_INTEGRATION_SQL, SCHEMA_LOCK_TIMEOUT_SQL } from '../src/db/ensureSchema.js'
import { createTestDatabase } from './helpers.js'

let ctx: Awaited<ReturnType<typeof createTestDatabase>>

beforeAll(async () => {
  ctx = await createTestDatabase({ integrationSchema: false })
}, 60_000)

afterAll(async () => {
  await ctx?.pg.close()
})

describe('M3: rev14/rev15 lock_timeout', () => {
  it('her rev kendi transaction\'ında SET LOCAL lock_timeout ile başlar; ayar oturuma sızmaz', async () => {
    const batches: string[][] = []
    const log = { log: vi.fn(), error: vi.fn() }
    const ok = await applyIntegrationSchema(async (statements) => {
      batches.push(statements)
      await ctx.pg.transaction(async (tx) => {
        for (const statement of statements) await tx.exec(statement)
        const inside = await tx.query<{ lock_timeout: string }>('SHOW lock_timeout')
        expect(inside.rows[0].lock_timeout).toBe('5s')
      })
    }, log)
    expect(ok).toBe(true)
    expect(SCHEMA_LOCK_TIMEOUT_SQL).toMatch(/^SET LOCAL lock_timeout = '5s'$/)
    expect(batches).toEqual([
      [SCHEMA_LOCK_TIMEOUT_SQL, REV14_INTEGRATION_SQL],
      [SCHEMA_LOCK_TIMEOUT_SQL, REV15_INTEGRATION_SQL],
    ])
    const after = await ctx.pg.query<{ lock_timeout: string }>('SHOW lock_timeout')
    expect(after.rows[0].lock_timeout).toBe('0')
    const tables = await ctx.pg.query<{ n: number }>(`select count(*)::int as n from pg_tables where tablename in ('api_keys','assistant_proposals','integration_events','case_enforcement')`)
    expect(tables.rows[0].n).toBe(4)
    expect(log.error).not.toHaveBeenCalled()
  })

  it('kilit zaman aşımı/hata loglanır, fırlatılmaz; rev15 atlanır (sonraki açılışta yeniden denenir)', async () => {
    const log = { log: vi.fn(), error: vi.fn() }
    const runner = vi.fn(async () => {
      throw Object.assign(new Error('canceling statement due to lock timeout'), { code: '55P03' })
    })
    await expect(applyIntegrationSchema(runner, log)).resolves.toBe(false)
    expect(runner).toHaveBeenCalledTimes(1)
    expect(log.error).toHaveBeenCalledTimes(1)
    expect(String(log.error.mock.calls[0][0])).toMatch(/sonraki acilista yeniden denenecek/)
  })
})
