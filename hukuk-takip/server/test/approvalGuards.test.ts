// İnceleme bulguları: HIGH1 (TARGET_CHANGED), HIGH2 (PROPOSAL_CHANGED), MED3 (external_ref NULL eşleşmesi).
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
  await ctx.db.insert(s.users).values({ id: A, email: 'guards@test', passwordHash: 'x', fullName: 'Avukat', role: 'lawyer' })
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

describe('HIGH2: görülmemiş güncellenmiş öneri uygulanmaz', () => {
  it('tekli onay expected_updated_at uyuşmazsa 409 PROPOSAL_CHANGED, öneri pending kalır', async () => {
    const [r] = await propose([hearing('g2:1', '2026-12-01T10:00:00+03:00')])
    const seen = await listed(r.proposal_id)
    // asistan aynı anahtarla öneriyi günceller (avukat eski hâli görüyor)
    const [u] = await propose([hearing('g2:1', '2026-12-02T10:00:00+03:00')])
    expect(u.status).toBe('updated')

    const stale = await call('POST', `/api/proposals/${r.proposal_id}/approve`, { token: jwt(), body: { expected_updated_at: seen.updatedAt } })
    expect(stale.status).toBe(409)
    expect(stale.body.code).toBe('PROPOSAL_CHANGED')
    const [p] = await ctx.db.select().from(s.assistantProposals).where(eq(s.assistantProposals.id, r.proposal_id))
    expect(p.status).toBe('pending')
    expect(await ctx.db.select().from(s.caseHearings).where(eq(s.caseHearings.externalRef, 'g2:1'))).toHaveLength(0)

    const fresh = await listed(r.proposal_id)
    const ok = await call('POST', `/api/proposals/${r.proposal_id}/approve`, { token: jwt(), body: { expected_updated_at: fresh.updatedAt } })
    expect(ok.status).toBe(200)
    expect(ok.body.status).toBe('applied')
  })

  it('expected_updated_at verilmezse eski istemci gibi çalışır', async () => {
    const [r] = await propose([hearing('g2:legacy', '2026-12-03T10:00:00+03:00')])
    const ok = await call('POST', `/api/proposals/${r.proposal_id}/approve`, { token: jwt(), body: {} })
    expect(ok.body.status).toBe('applied')
  })

  it('toplu uçta uyuşmayan kalem atlanır, diğerleri uygulanır', async () => {
    const [a, b] = await propose([hearing('g2:bulk-a', '2026-12-04T10:00:00+03:00'), hearing('g2:bulk-b', '2026-12-05T10:00:00+03:00')])
    const la = await listed(a.proposal_id)
    const lb = await listed(b.proposal_id)
    await propose([hearing('g2:bulk-b', '2026-12-06T10:00:00+03:00')])
    const bulk = await call('POST', '/api/proposals/bulk', {
      token: jwt(),
      body: { ids: [a.proposal_id, b.proposal_id], action: 'approve', expected_updated_at: { [a.proposal_id]: la.updatedAt, [b.proposal_id]: lb.updatedAt } },
    })
    expect(bulk.status).toBe(200)
    const byId = Object.fromEntries(bulk.body.results.map((r: any) => [r.id, r]))
    expect(byId[a.proposal_id].status).toBe('applied')
    expect(byId[b.proposal_id]).toMatchObject({ ok: false, code: 'PROPOSAL_CHANGED', status: 'error' })
    expect(typeof byId[b.proposal_id].error).toBe('string')
    const [pb] = await ctx.db.select().from(s.assistantProposals).where(eq(s.assistantProposals.id, b.proposal_id))
    expect(pb.status).toBe('pending')
  })
})

describe('HIGH1: onay avukatın elle düzenlemesini ezmez', () => {
  let hearingId = ''
  let pendingId = ''

  it('hedef öneriden sonra avukatça düzenlendiyse 409 TARGET_CHANGED (current, before, after)', async () => {
    const [first] = await propose([hearing('g1:1', '2026-12-10T10:00:00+03:00', { court_room: 'Salon 1' })])
    const applied = await call('POST', `/api/proposals/${first.proposal_id}/approve`, { token: jwt(), body: {} })
    hearingId = applied.body.targetId
    const [second] = await propose([hearing('g1:1', '2026-12-10T10:00:00+03:00', { court_room: 'Salon 2' })])
    pendingId = second.proposal_id
    const seen = await listed(pendingId)

    const edit = await call('PUT', `/api/hearings/${hearingId}`, { token: jwt(), body: { notes: 'Avukat notu: tanık getirilecek' } })
    expect(edit.status).toBe(200)

    const res = await call('POST', `/api/proposals/${pendingId}/approve`, { token: jwt(), body: { expected_updated_at: seen.updatedAt } })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('TARGET_CHANGED')
    expect(res.body.current).toMatchObject({ notes: 'Avukat notu: tanık getirilecek', courtRoom: 'Salon 1', updatedByActor: 'avukat' })
    expect(res.body.before).toMatchObject({ courtRoom: 'Salon 1', notes: null })
    expect(res.body.after).toMatchObject({ courtRoom: 'Salon 2' })
    const [row] = await ctx.db.select().from(s.caseHearings).where(eq(s.caseHearings.id, hearingId))
    expect(row).toMatchObject({ courtRoom: 'Salon 1', notes: 'Avukat notu: tanık getirilecek', updatedByActor: 'avukat' })
    const [p] = await ctx.db.select().from(s.assistantProposals).where(eq(s.assistantProposals.id, pendingId))
    expect(p.status).toBe('pending')
  })

  it('force_overwrite: true ile uygulanır, avukatın diğer alanı korunur', async () => {
    const seen = await listed(pendingId)
    const res = await call('POST', `/api/proposals/${pendingId}/approve`, { token: jwt(), body: { expected_updated_at: seen.updatedAt, force_overwrite: true } })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('applied')
    const [row] = await ctx.db.select().from(s.caseHearings).where(eq(s.caseHearings.id, hearingId))
    expect(row).toMatchObject({ courtRoom: 'Salon 2', notes: 'Avukat notu: tanık getirilecek', updatedByActor: 'asistan' })
    const events = await ctx.db.select().from(s.integrationEvents).where(and(eq(s.integrationEvents.proposalId, pendingId), eq(s.integrationEvents.action, 'proposal_applied')))
    expect((events[0].details as any).force_overwrite).toBe(true)
  })

  it('toplu onayda çakışan kalem TARGET_CHANGED ile atlanır, force_overwrite yok sayılır', async () => {
    const [p] = await propose([hearing('g1:1', '2026-12-10T10:00:00+03:00', { court_room: 'Salon 3' })])
    await call('PUT', `/api/hearings/${hearingId}`, { token: jwt(), body: { judge: 'Avukatın hakimi' } })
    const seen = await listed(p.proposal_id)
    const bulk = await call('POST', '/api/proposals/bulk', { token: jwt(), body: { ids: [p.proposal_id], action: 'approve', force_overwrite: true, expected_updated_at: { [p.proposal_id]: seen.updatedAt } } })
    expect(bulk.body.results[0]).toMatchObject({ id: p.proposal_id, ok: false, code: 'TARGET_CHANGED' })
    const [row] = await ctx.db.select().from(s.caseHearings).where(eq(s.caseHearings.id, hearingId))
    expect(row.courtRoom).toBe('Salon 2')
  })

  it('aynı partideki asistan değişikliği ilgisiz alanda ise bloklamaz (dava + durum)', async () => {
    const res = await propose([
      { kind: 'case_upsert', external_ref: 'uyap:dosya:2026/7', case_ref: { id: caseA }, payload: { description: 'UYAP açıklaması' }, summary: 'dava', source: 'uyap', request_id: rid() },
      { kind: 'status_change', external_ref: 'uyap:durum:2026/7', case_ref: { id: caseA }, payload: { status: 'istinafta' }, summary: 'durum', source: 'uyap', request_id: rid() },
    ])
    const bulk = await call('POST', '/api/proposals/bulk', { token: jwt(), body: { ids: res.map((r) => r.proposal_id), action: 'approve' } })
    expect(bulk.body.results.map((r: any) => r.status)).toEqual(['applied', 'applied'])
  })
})
