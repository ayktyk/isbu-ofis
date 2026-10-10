// İkinci inceleme düşük önemli bulguları: L2 (request_id kullanıcı kapsamı),
// L4 (API anahtarı last_used_at yazımı dakikada en çok bir kez).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import * as s from '../src/db/schema.js'
import { client, createTestDatabase, startApp, tokenFor } from './helpers.js'

let ctx: Awaited<ReturnType<typeof createTestDatabase>>
let app: Awaited<ReturnType<typeof startApp>>
let call: ReturnType<typeof client>
const A = randomUUID()
const B = randomUUID()
let caseA = ''
let caseB = ''
let keyA = ''
let keyB = ''
const rid = () => `req-${randomUUID()}`

const task = (caseId: string, ref: string, requestId: string, title = 'Görev') => ({
  kind: 'task_add', external_ref: ref, case_ref: { id: caseId }, payload: { title }, summary: 'görev', source: 'asistan', request_id: requestId,
})

beforeAll(async () => {
  ctx = await createTestDatabase()
  for (const [id, email] of [[A, 'low-a@test'], [B, 'low-b@test']] as const) {
    await ctx.db.insert(s.users).values({ id, email, passwordHash: 'x', fullName: email, role: 'lawyer' })
  }
  const [clA] = await ctx.db.insert(s.clients).values({ userId: A, fullName: 'Müvekkil A' }).returning()
  const [clB] = await ctx.db.insert(s.clients).values({ userId: B, fullName: 'Müvekkil B' }).returning()
  caseA = (await ctx.db.insert(s.cases).values({ userId: A, clientId: clA.id, title: 'Dava A', caseType: 'kira' }).returning())[0].id
  caseB = (await ctx.db.insert(s.cases).values({ userId: B, clientId: clB.id, title: 'Dava B', caseType: 'kira' }).returning())[0].id
  const integration = (await import('../src/routes/integration.js')).default
  const keys = (await import('../src/routes/integrationKeys.js')).default
  app = await startApp((e) => {
    e.use('/api/integration', integration)
    e.use('/api/integration-keys', keys)
  })
  call = client(app.base)
  keyA = (await call('POST', '/api/integration-keys', { token: tokenFor(A), body: { name: 'Asistan A', scopes: ['read', 'propose'] } })).body.key
  keyB = (await call('POST', '/api/integration-keys', { token: tokenFor(B), body: { name: 'Asistan B', scopes: ['read', 'propose'] } })).body.key
}, 60_000)

afterAll(async () => {
  await app?.close()
  await ctx?.pg.close()
})

describe('L2: request_id kontrolü kullanıcı kapsamında', () => {
  it('başka kullanıcının bekleyen önerisindeki request_id genel hata alır, kayıt ifşa edilmez', async () => {
    const shared = rid()
    const a = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [task(caseA, 'l2:a', shared)] } })
    expect(a.body.results[0].status).toBe('created')
    const b = await call('POST', '/api/integration/proposals', { key: keyB, body: { items: [task(caseB, 'l2:b', shared)] } })
    const item = b.body.results[0]
    expect(item.status).toBe('error')
    expect(item.proposal_id).toBeUndefined()
    expect(item.error).toBe('Öğe işlenemedi; yeni bir request_id ile yeniden gönderin.')
    expect(JSON.stringify(item)).not.toMatch(/başka|kullanıcı|kayıt/i)
  })

  it('yalnız başka kullanıcının olay geçmişinde kalan request_id engellemez', async () => {
    const old = rid()
    await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [task(caseA, 'l2:c', old, 'İlk')] } })
    // Aynı anahtarın yeni sürümü: bekleyen önerinin request_id'si değişir, eskisi yalnız olaylarda kalır.
    const upd = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [task(caseA, 'l2:c', rid(), 'İkinci')] } })
    expect(upd.body.results[0].status).toBe('updated')
    const b = await call('POST', '/api/integration/proposals', { key: keyB, body: { items: [task(caseB, 'l2:d', old)] } })
    expect(b.body.results[0].status).toBe('created')
    // A için aynı eski request_id hâlâ tekrar sayılır
    const again = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [task(caseA, 'l2:c', old, 'İlk')] } })
    expect(again.body.results[0].status).toBe('duplicate')
  })
})

describe('L4: last_used_at dakikada en çok bir kez yazılır', () => {
  it('son kullanım 1 dakikadan yeniyse yazılmaz, eskiyse güncellenir', async () => {
    const [row] = await ctx.db.select().from(s.apiKeys).where(eq(s.apiKeys.userId, A))
    const recent = new Date(Date.now() - 30_000)
    await ctx.db.update(s.apiKeys).set({ lastUsedAt: recent }).where(eq(s.apiKeys.id, row.id))
    expect((await call('GET', '/api/integration/pulse', { key: keyA })).status).toBe(200)
    const [same] = await ctx.db.select().from(s.apiKeys).where(eq(s.apiKeys.id, row.id))
    expect(same.lastUsedAt?.getTime()).toBe(recent.getTime())

    const stale = new Date(Date.now() - 120_000)
    await ctx.db.update(s.apiKeys).set({ lastUsedAt: stale }).where(eq(s.apiKeys.id, row.id))
    expect((await call('GET', '/api/integration/pulse', { key: keyA })).status).toBe(200)
    const [fresh] = await ctx.db.select().from(s.apiKeys).where(eq(s.apiKeys.id, row.id))
    expect(fresh.lastUsedAt!.getTime()).toBeGreaterThan(stale.getTime() + 60_000)
  })
})
