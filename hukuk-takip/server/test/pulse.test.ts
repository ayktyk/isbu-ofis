import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import * as s from '../src/db/schema.js'
import { client, createTestDatabase, startApp, tokenFor } from './helpers.js'

let ctx: Awaited<ReturnType<typeof createTestDatabase>>
let app: Awaited<ReturnType<typeof startApp>>
let call: ReturnType<typeof client>
const A = randomUUID()
let caseA: string

const OLD = new Date('2026-08-01T09:00:00Z')

beforeAll(async () => {
  ctx = await createTestDatabase()
  const { db } = ctx
  await db.insert(s.users).values({ id: A, email: 'pulse@test', passwordHash: 'x', fullName: 'Avukat', role: 'lawyer' })
  const [cl] = await db.insert(s.clients).values({ userId: A, fullName: 'Müvekkil' }).returning()
  const [c] = await db.insert(s.cases).values({ userId: A, clientId: cl.id, title: 'Eski dava', caseType: 'kira', createdAt: OLD, updatedAt: OLD }).returning()
  caseA = c.id
  const pulse = (await import('../src/routes/pulse.js')).default
  const tasksRouter = (await import('../src/routes/tasks.js')).default
  app = await startApp((e) => {
    e.use('/api/pulse', pulse)
    e.use('/api/tasks', tasksRouter)
  })
  call = client(app.base)
}, 60_000)

afterAll(async () => {
  await app?.close()
  await ctx?.pg.close()
})

describe('dosya nabzı (sunucu)', () => {
  it('LOW6: görev sıralaması son hareketi ve updatedAt değerini değiştirmez', async () => {
    const [t1] = await ctx.db.insert(s.tasks).values({ userId: A, caseId: caseA, title: 'Birinci', status: 'completed', createdAt: OLD, updatedAt: OLD, completedAt: OLD }).returning()
    const [t2] = await ctx.db.insert(s.tasks).values({ userId: A, caseId: caseA, title: 'İkinci', status: 'completed', createdAt: OLD, updatedAt: OLD, completedAt: OLD }).returning()
    const before = (await call('GET', '/api/pulse', { token: tokenFor(A) })).body.find((p: any) => p.id === caseA)
    expect(before.lastActivityAt).toBe(OLD.toISOString())

    const reorder = await call('PATCH', '/api/tasks/reorder', { token: tokenFor(A), body: { ids: [t2.id, t1.id] } })
    expect(reorder.status).toBe(200)
    const [row] = await ctx.db.select().from(s.tasks).where(eq(s.tasks.id, t2.id))
    expect(row.sortOrder).toBe(0)
    expect(row.updatedAt.toISOString()).toBe(OLD.toISOString())

    const after = (await call('GET', '/api/pulse', { token: tokenFor(A) })).body.find((p: any) => p.id === caseA)
    expect(after.lastActivityAt).toBe(OLD.toISOString())
    expect(after.flags).toContain('atil')
  })

  it('LOW7: sonucu girilmemiş geçmiş duruşma gecikmiş görünür', async () => {
    await ctx.db.insert(s.caseHearings).values({ caseId: caseA, hearingDate: new Date(Date.now() - 5 * 86_400_000), result: 'pending' })
    const item = (await call('GET', '/api/pulse', { token: tokenFor(A) })).body.find((p: any) => p.id === caseA)
    expect(item.flags).toContain('gecikmis')
    expect(item.nextItem).toMatchObject({ kind: 'hearing', overdue: true, title: 'Duruşma sonucu girilmedi' })
  })

  it('arabuluculuk dosyası kendi tarihlerinden sıradaki işi alır', async () => {
    const [m] = await ctx.db.insert(s.mediationFiles).values({ userId: A, mediationType: 'dava_sarti', disputeType: 'İşçi-işveren', startDate: '2026-10-01', status: 'active' }).returning()
    const [empty] = await ctx.db.insert(s.mediationFiles).values({ userId: A, mediationType: 'ihtiyari', disputeType: 'Ticari', status: 'active' }).returning()
    const body = (await call('GET', '/api/pulse', { token: tokenFor(A) })).body
    const item = body.find((p: any) => p.id === m.id)
    expect(item.type).toBe('mediation')
    expect(item.nextItem).toMatchObject({ kind: 'check', date: null })
    expect(item.flags).not.toContain('sirada_is_yok')
    expect(body.find((p: any) => p.id === empty.id).flags).toContain('sirada_is_yok')
  })
})
