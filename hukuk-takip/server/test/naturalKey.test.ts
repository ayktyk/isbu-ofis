// İnceleme bulgusu MED3: external_ref NULL (avukatın elle girdiği) kayıtla eşleştirme.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import * as s from '../src/db/schema.js'
import { client, createTestDatabase, startApp, tokenFor } from './helpers.js'

let ctx: Awaited<ReturnType<typeof createTestDatabase>>
let app: Awaited<ReturnType<typeof startApp>>
let call: ReturnType<typeof client>
const A = randomUUID()
let caseA = ''
let key = ''
const rid = () => `req-${randomUUID()}`
const jwt = () => tokenFor(A)

async function propose(items: unknown[]) {
  const res = await call('POST', '/api/integration/proposals', { key, body: { items } })
  expect([200, 207]).toContain(res.status)
  return res.body.results as any[]
}

async function listed(id: string) {
  const res = await call('GET', '/api/proposals?status=all', { token: jwt() })
  return res.body.find((p: any) => p.id === id)
}

const hearing = (ref: string, date: string, payload: Record<string, unknown> = {}) => ({
  kind: 'hearing_upsert', external_ref: ref, case_ref: { id: caseA },
  payload: { hearing_date: date, ...payload }, summary: 'Duruşma', source: 'uyap', request_id: rid(),
})

beforeAll(async () => {
  ctx = await createTestDatabase()
  await ctx.db.insert(s.users).values({ id: A, email: 'natural@test', passwordHash: 'x', fullName: 'Avukat', role: 'lawyer' })
  const [cl] = await ctx.db.insert(s.clients).values({ userId: A, fullName: 'Müvekkil' }).returning()
  const [c] = await ctx.db.insert(s.cases).values({ userId: A, clientId: cl.id, title: 'Dava', caseType: 'kira', caseNumber: '2026/7', courtName: 'Kadıköy 1. Sulh Hukuk' }).returning()
  caseA = c.id
  const integration = (await import('../src/routes/integration.js')).default
  const keys = (await import('../src/routes/integrationKeys.js')).default
  const proposals = (await import('../src/routes/proposals.js')).default
  const hearings = (await import('../src/routes/hearings.js')).default
  app = await startApp((e) => {
    e.use('/api/integration', integration)
    e.use('/api/integration-keys', keys)
    e.use('/api/proposals', proposals)
    e.use('/api/hearings', hearings)
  })
  call = client(app.base)
  key = (await call('POST', '/api/integration-keys', { token: jwt(), body: { name: 'Asistan', scopes: ['read', 'propose'] } })).body.key
}, 60_000)

afterAll(async () => {
  await app?.close()
  await ctx?.pg.close()
})

describe('MED3: external_ref NULL kayıtla eşleştirme', () => {
  it('aynı gün/saatteki avukat duruşmasına bağlanır, yenisini açmaz', async () => {
    const [own] = await ctx.db.insert(s.caseHearings).values({ caseId: caseA, hearingDate: new Date('2027-01-15T07:30:00Z'), updatedByActor: 'avukat' }).returning()
    const [r] = await propose([hearing('uyap:2026/7:durusma:9', '2027-01-15T10:30:00+03:00', { court_room: 'Salon 7' })])
    expect(r.status).toBe('created')
    const [p] = await ctx.db.select().from(s.assistantProposals).where(eq(s.assistantProposals.id, r.proposal_id))
    expect(p.targetId).toBe(own.id)
    const ok = await call('POST', `/api/proposals/${r.proposal_id}/approve`, { token: jwt(), body: {} })
    expect(ok.body).toMatchObject({ status: 'applied', targetId: own.id })
    const rows = await ctx.db.select().from(s.caseHearings).where(and(eq(s.caseHearings.caseId, caseA), eq(s.caseHearings.hearingDate, new Date('2027-01-15T07:30:00Z'))))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ externalRef: 'uyap:2026/7:durusma:9', courtRoom: 'Salon 7' })
  })

  it('değer değişmese de bağlantı için öneri açılır (no_change değil)', async () => {
    await ctx.db.insert(s.caseHearings).values({ caseId: caseA, hearingDate: new Date('2027-02-01T06:00:00Z'), courtRoom: 'Salon 1', updatedByActor: 'avukat' })
    const [r] = await propose([hearing('uyap:2026/7:durusma:10', '2027-02-01T09:00:00+03:00', { court_room: 'Salon 1' })])
    expect(r.status).toBe('created')
  })

  it('süreli iş: dava + başlık + aynı vade günü ile eşleşir', async () => {
    const [own] = await ctx.db.insert(s.tasks).values({ userId: A, caseId: caseA, title: 'Cevap dilekçesi', isDeadline: true, dueDate: new Date('2027-01-20T06:00:00Z'), updatedByActor: 'avukat' }).returning()
    const results = await propose([
      { kind: 'deadline_upsert', external_ref: 'kalkan:2026/7:cevap', case_ref: { id: caseA }, payload: { title: 'Cevap dilekçesi', due_date: '2027-01-20', legal_basis: 'HMK 127' }, summary: 'süre', source: 'kalkan', request_id: rid() },
      { kind: 'deadline_upsert', external_ref: 'kalkan:2026/7:baska-gun', case_ref: { id: caseA }, payload: { title: 'Cevap dilekçesi', due_date: '2027-01-21' }, summary: 'süre', source: 'kalkan', request_id: rid() },
    ])
    const bulk = await call('POST', '/api/proposals/bulk', { token: jwt(), body: { ids: results.map((r) => r.proposal_id), action: 'approve' } })
    expect(bulk.body.results.map((r: any) => r.status)).toEqual(['applied', 'applied'])
    const [linked] = await ctx.db.select().from(s.tasks).where(eq(s.tasks.id, own.id))
    expect(linked).toMatchObject({ externalRef: 'kalkan:2026/7:cevap', legalBasis: 'HMK 127', title: 'Cevap dilekçesi' })
    const all = await ctx.db.select().from(s.tasks).where(and(eq(s.tasks.caseId, caseA), eq(s.tasks.isDeadline, true)))
    expect(all).toHaveLength(2)
  })
})
