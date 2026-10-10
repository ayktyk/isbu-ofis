// İkinci inceleme bulguları: H1 (toplu/tekli onayda avukat değerinin ezilmesi),
// M1 (doğal anahtarla aynı kayda iki ref → kopya), M2 (onayda hedef satır kilidi).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import * as s from '../src/db/schema.js'
import { client, createTestDatabase, startApp, tokenFor } from './helpers.js'

let ctx: Awaited<ReturnType<typeof createTestDatabase>>
let app: Awaited<ReturnType<typeof startApp>>
let call: ReturnType<typeof client>
const A = randomUUID()
let caseA = ''
let key = ''
const queryLog: string[] = []
const rid = () => `req-${randomUUID()}`
const jwt = () => tokenFor(A)

const hearing = (ref: string, date: string, payload: Record<string, unknown> = {}) => ({
  kind: 'hearing_upsert', external_ref: ref, case_ref: { id: caseA },
  payload: { hearing_date: date, ...payload }, summary: 'Duruşma', source: 'uyap', request_id: rid(),
})

async function propose(items: unknown[]) {
  const res = await call('POST', '/api/integration/proposals', { key, body: { items } })
  expect([200, 207]).toContain(res.status)
  return res.body.results as any[]
}

async function seen(id: string) {
  const res = await call('GET', '/api/proposals?status=all', { token: jwt() })
  return res.body.find((p: any) => p.id === id)
}

async function hearingRow(id: string) {
  const [row] = await ctx.db.select().from(s.caseHearings).where(eq(s.caseHearings.id, id))
  return row
}

async function proposalRow(id: string) {
  const [row] = await ctx.db.select().from(s.assistantProposals).where(eq(s.assistantProposals.id, id))
  return row
}

beforeAll(async () => {
  ctx = await createTestDatabase({ queryLog })
  await ctx.db.insert(s.users).values({ id: A, email: 'review2@test', passwordHash: 'x', fullName: 'Avukat', role: 'lawyer' })
  const [cl] = await ctx.db.insert(s.clients).values({ userId: A, fullName: 'Müvekkil' }).returning()
  const [c] = await ctx.db.insert(s.cases).values({ userId: A, clientId: cl.id, title: 'Dava', caseType: 'kira', caseNumber: '2026/7', courtName: 'Kadıköy 1. Sulh Hukuk' }).returning()
  caseA = c.id
  const integration = (await import('../src/routes/integration.js')).default
  const keys = (await import('../src/routes/integrationKeys.js')).default
  const proposals = (await import('../src/routes/proposals.js')).default
  app = await startApp((e) => {
    e.use('/api/integration', integration)
    e.use('/api/integration-keys', keys)
    e.use('/api/proposals', proposals)
  })
  call = client(app.base)
  key = (await call('POST', '/api/integration-keys', { token: jwt(), body: { name: 'Asistan', scopes: ['read', 'propose'] } })).body.key
}, 60_000)

afterAll(async () => {
  await app?.close()
  await ctx?.pg.close()
})

describe('H1: avukatın dolu değeri onayda ezilmez', () => {
  it('boş/boşluk değerli öneri açılmaz; eski (boş değerli) öneri toplu onayda notu silmez', async () => {
    const [h] = await ctx.db.insert(s.caseHearings).values({ caseId: caseA, hearingDate: new Date('2026-12-10T07:00:00Z'), notes: 'AVUKAT NOTU', courtRoom: 'Salon 1', externalRef: 'h1:1' }).returning()
    const [r] = await propose([hearing('h1:1', '2026-12-10T10:00:00+03:00', { notes: '', court_room: '   ' })])
    expect(r.status).toBe('no_change')

    // Düzeltme öncesi kaydedilmiş (boş değer taşıyan) öneri
    const [legacy] = await ctx.db.insert(s.assistantProposals).values({
      userId: A, kind: 'hearing_upsert', caseId: caseA, targetType: 'hearing', targetId: h.id, externalRef: 'h1:1',
      payload: { hearing_date: '2026-12-10T10:00:00+03:00', notes: '', court_room: '   ' },
      before: { hearingDate: '2026-12-10T07:00:00.000Z', courtRoom: 'Salon 1', judge: null, notes: 'AVUKAT NOTU', result: 'pending', updatedByActor: 'avukat', updatedAt: h.updatedAt.toISOString() },
      conflict: true, summary: 'eski', source: 'uyap', requestId: rid(),
    }).returning()
    const p = await seen(legacy.id)
    const bulk = await call('POST', '/api/proposals/bulk', { token: jwt(), body: { ids: [legacy.id], action: 'approve', expected_updated_at: { [legacy.id]: p.updatedAt } } })
    expect(bulk.body.results[0]).toMatchObject({ ok: false, code: 'CONFLICT_REVIEW_REQUIRED' })
    const row = await hearingRow(h.id)
    expect(row.notes).toBe('AVUKAT NOTU')
    expect(row.courtRoom).toBe('Salon 1')
  })

  it('toplu onay çakışmalı kalemi CONFLICT_REVIEW_REQUIRED ile atlar, kayıt değişmez', async () => {
    const [h] = await ctx.db.insert(s.caseHearings).values({ caseId: caseA, hearingDate: new Date('2026-12-11T07:00:00Z'), notes: 'AVUKAT NOTU', externalRef: 'h1:2' }).returning()
    const [r] = await propose([hearing('h1:2', '2026-12-11T10:00:00+03:00', { notes: 'ASİSTAN NOTU' })])
    expect(r).toMatchObject({ status: 'created', conflict: true })
    const p = await seen(r.proposal_id)
    const bulk = await call('POST', '/api/proposals/bulk', { token: jwt(), body: { ids: [r.proposal_id], action: 'approve', expected_updated_at: { [r.proposal_id]: p.updatedAt } } })
    expect(bulk.body.results[0]).toEqual({ id: r.proposal_id, ok: false, status: 'error', code: 'CONFLICT_REVIEW_REQUIRED', error: 'Tekli incelemeyle onaylayın' })
    expect((await hearingRow(h.id)).notes).toBe('AVUKAT NOTU')
    expect((await proposalRow(r.proposal_id)).status).toBe('pending')
  })

  it('onay anında yeniden hesaplanan çakışma da toplu onayda atlanır (öneri conflict=false olsa bile)', async () => {
    const [h] = await ctx.db.insert(s.caseHearings).values({ caseId: caseA, hearingDate: new Date('2026-12-12T07:00:00Z'), notes: 'AVUKAT NOTU', externalRef: 'h1:3' }).returning()
    const [r] = await propose([hearing('h1:3', '2026-12-12T10:00:00+03:00', { notes: 'ASİSTAN NOTU' })])
    await ctx.db.update(s.assistantProposals).set({ conflict: false }).where(eq(s.assistantProposals.id, r.proposal_id))
    const bulk = await call('POST', '/api/proposals/bulk', { token: jwt(), body: { ids: [r.proposal_id], action: 'approve' } })
    expect(bulk.body.results[0]).toMatchObject({ ok: false, code: 'CONFLICT_REVIEW_REQUIRED' })
    expect((await hearingRow(h.id)).notes).toBe('AVUKAT NOTU')
  })

  it('tekli onayda çakışmalı öneri force_overwrite olmadan 409 CONFLICT_REVIEW_REQUIRED; force ile uygulanır', async () => {
    const [h] = await ctx.db.insert(s.caseHearings).values({ caseId: caseA, hearingDate: new Date('2026-12-13T07:00:00Z'), notes: 'AVUKAT NOTU', externalRef: 'h1:4' }).returning()
    const [r] = await propose([hearing('h1:4', '2026-12-13T10:00:00+03:00', { notes: 'ASİSTAN NOTU' })])
    const p = await seen(r.proposal_id)
    const blocked = await call('POST', `/api/proposals/${r.proposal_id}/approve`, { token: jwt(), body: { expected_updated_at: p.updatedAt } })
    expect(blocked.status).toBe(409)
    expect(blocked.body).toMatchObject({ code: 'CONFLICT_REVIEW_REQUIRED', overwritten_fields: ['notes'] })
    expect((await hearingRow(h.id)).notes).toBe('AVUKAT NOTU')
    expect((await proposalRow(r.proposal_id)).status).toBe('pending')

    const forced = await call('POST', `/api/proposals/${r.proposal_id}/approve`, { token: jwt(), body: { expected_updated_at: p.updatedAt, force_overwrite: true } })
    expect(forced.body.status).toBe('applied')
    expect((await hearingRow(h.id)).notes).toBe('ASİSTAN NOTU')
  })

  it('avukat tekli onayda çakışan alanı düzenleyip çıkarırsa 409 dönmez', async () => {
    const [h] = await ctx.db.insert(s.caseHearings).values({ caseId: caseA, hearingDate: new Date('2026-12-14T07:00:00Z'), notes: 'AVUKAT NOTU', externalRef: 'h1:5' }).returning()
    const [r] = await propose([hearing('h1:5', '2026-12-14T10:00:00+03:00', { notes: 'ASİSTAN NOTU', judge: 'Hakim Y' })])
    const p = await seen(r.proposal_id)
    const ok = await call('POST', `/api/proposals/${r.proposal_id}/approve`, { token: jwt(), body: { expected_updated_at: p.updatedAt, payload: { hearing_date: '2026-12-14T10:00:00+03:00', judge: 'Hakim Y' } } })
    expect(ok.body.status).toBe('applied')
    expect(await hearingRow(h.id)).toMatchObject({ notes: 'AVUKAT NOTU', judge: 'Hakim Y' })
  })
})

describe('M1: doğal anahtarla aynı kayda bağlanan ikinci ref kopya açmaz', () => {
  it('ikinci onay 409 TARGET_CHANGED, tek duruşma kalır', async () => {
    const [h] = await ctx.db.insert(s.caseHearings).values({ caseId: caseA, hearingDate: new Date('2026-12-20T07:00:00Z'), courtRoom: 'Salon 9' }).returning()
    const results = await propose([
      hearing('nk:1', '2026-12-20T10:00:00+03:00', { judge: 'Hakim X' }),
      hearing('nk:2', '2026-12-20T10:00:00+03:00', { judge: 'Hakim X' }),
    ])
    expect(results.map((r) => r.status)).toEqual(['created', 'created'])
    const ids = results.map((r) => r.proposal_id)
    const bulk = await call('POST', '/api/proposals/bulk', { token: jwt(), body: { ids, action: 'approve' } })
    expect(bulk.body.results[0]).toMatchObject({ status: 'applied', targetId: h.id })
    expect(bulk.body.results[1]).toMatchObject({ ok: false, code: 'TARGET_CHANGED' })
    const single = await call('POST', `/api/proposals/${ids[1]}/approve`, { token: jwt(), body: { force_overwrite: true } })
    expect(single.status).toBe(409)
    expect(single.body.code).toBe('TARGET_CHANGED')
    const rows = await ctx.db.select().from(s.caseHearings).where(sql`${s.caseHearings.hearingDate} = '2026-12-20 07:00:00' and ${s.caseHearings.archivedAt} is null`)
    expect(rows.map((r) => [r.id, r.externalRef])).toEqual([[h.id, 'nk:1']])
    expect((await proposalRow(ids[1])).status).toBe('pending')
  })

  it('doğal anahtar sonradan değişse de onay hedefi targetId ile bulur, kopya açmaz', async () => {
    const [h] = await ctx.db.insert(s.caseHearings).values({ caseId: caseA, hearingDate: new Date('2026-12-21T07:00:00Z') }).returning()
    const [r] = await propose([hearing('nk:3', '2026-12-21T10:00:00+03:00', { judge: 'Hakim Z' })])
    expect((await proposalRow(r.proposal_id)).targetId).toBe(h.id)
    await ctx.db.update(s.caseHearings).set({ hearingDate: new Date('2026-12-22T07:00:00Z') }).where(eq(s.caseHearings.id, h.id))
    const before = (await ctx.db.select().from(s.caseHearings).where(eq(s.caseHearings.caseId, caseA))).length
    const blocked = await call('POST', `/api/proposals/${r.proposal_id}/approve`, { token: jwt(), body: {} })
    expect(blocked.status).toBe(409)
    expect(blocked.body.code).toBe('TARGET_CHANGED')
    expect((await ctx.db.select().from(s.caseHearings).where(eq(s.caseHearings.caseId, caseA))).length).toBe(before)
  })
})

describe('M2: onay yolunda hedef satır kilitlenir', () => {
  it('duruşma, görev ve dava hedefleri SELECT ... FOR UPDATE ile okunur', async () => {
    const [h] = await ctx.db.insert(s.caseHearings).values({ caseId: caseA, hearingDate: new Date('2026-12-30T07:00:00Z'), externalRef: 'lock:h' }).returning()
    const results = await propose([
      hearing('lock:h', '2026-12-30T10:00:00+03:00', { judge: 'Kilit' }),
      { kind: 'task_add', external_ref: 'lock:t', case_ref: { id: caseA }, payload: { title: 'Kilit görevi' }, summary: 'g', source: 'asistan', request_id: rid() },
      { kind: 'status_change', external_ref: 'lock:s', case_ref: { id: caseA }, payload: { status: 'passive' }, summary: 'd', source: 'uyap', request_id: rid() },
    ])
    queryLog.length = 0
    for (const r of results) {
      await call('POST', `/api/proposals/${r.proposal_id}/approve`, { token: jwt(), body: { force_overwrite: true } })
    }
    const locked = queryLog.filter((q) => /for update/i.test(q))
    expect(locked.some((q) => /from "case_hearings"/i.test(q))).toBe(true)
    expect(locked.some((q) => /from "tasks"/i.test(q))).toBe(true)
    expect(locked.some((q) => /from "cases"/i.test(q))).toBe(true)
    expect((await hearingRow(h.id)).judge).toBe('Kilit')
  })
})
