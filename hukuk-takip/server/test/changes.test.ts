import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import * as s from '../src/db/schema.js'
import { client, createTestDatabase, startApp, tokenFor } from './helpers.js'

let ctx: Awaited<ReturnType<typeof createTestDatabase>>
let app: Awaited<ReturnType<typeof startApp>>
let call: ReturnType<typeof client>
const A = randomUUID()
let key = ''
let caseId = ''

beforeAll(async () => {
  ctx = await createTestDatabase()
  await ctx.db.insert(s.users).values({ id: A, email: 'changes@test', passwordHash: 'x', fullName: 'Avukat', role: 'lawyer' })
  const [cl] = await ctx.db.insert(s.clients).values({ userId: A, fullName: 'Müvekkil' }).returning()
  const [c] = await ctx.db.insert(s.cases).values({ userId: A, clientId: cl.id, title: 'Dava', caseType: 'kira', updatedAt: new Date('2026-01-01T00:00:00Z') }).returning()
  caseId = c.id
  const integration = (await import('../src/routes/integration.js')).default
  const keys = (await import('../src/routes/integrationKeys.js')).default
  app = await startApp((e) => {
    e.use('/api/integration', integration)
    e.use('/api/integration-keys', keys)
  })
  call = client(app.base)
  key = (await call('POST', '/api/integration-keys', { token: tokenFor(A), body: { name: 'Okuma', scopes: ['read'] } })).body.key
}, 60_000)

afterAll(async () => {
  await app?.close()
  await ctx?.pg.close()
})

describe('MED4: /changes keyset sayfalama', () => {
  it('eşit zaman damgalı satırları atlamadan ve tekrarlamadan sayfalar', async () => {
    // 5 görev: üçü aynı mikro-saniyeli zaman damgasında, ikisi aynı milisaniyede.
    await ctx.pg.exec(`
      INSERT INTO tasks (user_id, case_id, title, updated_at, updated_by_actor) VALUES
        ('${A}', '${caseId}', 'g1', '2026-10-01 10:00:00.123456', 'avukat'),
        ('${A}', '${caseId}', 'g2', '2026-10-01 10:00:00.123456', 'avukat'),
        ('${A}', '${caseId}', 'g3', '2026-10-01 10:00:00.123456', 'avukat'),
        ('${A}', '${caseId}', 'g4', '2026-10-01 10:00:00.123', 'avukat'),
        ('${A}', '${caseId}', 'g5', '2026-10-01 10:00:00.123', 'avukat'),
        ('${A}', '${caseId}', 'asistanin', '2026-10-01 10:00:00.5', 'asistan')
    `)
    const seen: string[] = []
    let res = await call('GET', `/api/integration/changes?since=${encodeURIComponent('2026-09-30T00:00:00Z')}&limit=2`, { key })
    expect(res.status).toBe(200)
    expect(res.body.truncated).toBe(true)
    expect(typeof res.body.next_cursor).toBe('string')
    seen.push(...res.body.tasks.map((t: any) => t.title))
    for (let i = 0; i < 10 && res.body.truncated; i++) {
      res = await call('GET', `/api/integration/changes?cursor=${encodeURIComponent(res.body.next_cursor)}&limit=2`, { key })
      expect(res.status).toBe(200)
      seen.push(...res.body.tasks.map((t: any) => t.title))
    }
    expect(res.body.truncated).toBe(false)
    expect(seen.sort()).toEqual(['g1', 'g2', 'g3', 'g4', 'g5'])

    // Son imleçle tekrar sorgu: yeni değişiklik yoksa boş döner, imleç ilerlemez.
    const tail = await call('GET', `/api/integration/changes?cursor=${encodeURIComponent(res.body.next_cursor)}`, { key })
    expect(tail.body.tasks).toHaveLength(0)
    expect(tail.body.next_cursor).toBe(res.body.next_cursor)

    // Sonra gelen avukat değişikliği imleçle yakalanır.
    await ctx.pg.exec(`INSERT INTO tasks (user_id, title, updated_at, updated_by_actor) VALUES ('${A}', 'g7', '2026-10-02 08:00:00', 'avukat')`)
    const latest = await call('GET', `/api/integration/changes?cursor=${encodeURIComponent(res.body.next_cursor)}`, { key })
    expect(latest.body.tasks.map((t: any) => t.title)).toEqual(['g7'])
  })

  it('geçersiz imleç ve eksik parametre 400 döner', async () => {
    expect((await call('GET', '/api/integration/changes?cursor=bozuk', { key })).status).toBe(400)
    expect((await call('GET', '/api/integration/changes', { key })).status).toBe(400)
  })
})
