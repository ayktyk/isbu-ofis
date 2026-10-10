import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import * as s from '../src/db/schema.js'
import { REV14_INTEGRATION_SQL } from '../src/db/ensureSchema.js'
import { client, createTestDatabase, NEW_TABLES, startApp, tokenFor } from './helpers.js'

let ctx: Awaited<ReturnType<typeof createTestDatabase>>
let app: Awaited<ReturnType<typeof startApp>>
let call: ReturnType<typeof client>
const A = randomUUID()
const B = randomUUID()
let caseA: string
let clientA: string
let caseB: string
let keyA = ''
let readOnlyKeyA = ''
let keyB = ''

const rid = () => `req-${randomUUID()}`

async function createKey(userId: string, scopes: string[]) {
  const res = await call('POST', '/api/integration-keys', { token: tokenFor(userId), body: { name: `Test ${scopes.join('+')}`, scopes } })
  expect(res.status).toBe(201)
  return res.body as { id: string; key: string; keyPrefix: string }
}

beforeAll(async () => {
  ctx = await createTestDatabase()
  const { db } = ctx
  await db.insert(s.users).values([
    { id: A, email: 'a@test', passwordHash: 'x', fullName: 'Avukat A', role: 'lawyer' },
    { id: B, email: 'b@test', passwordHash: 'x', fullName: 'Avukat B', role: 'lawyer' },
  ])
  const [cA] = await db.insert(s.clients).values({ userId: A, fullName: 'Müvekkil A' }).returning()
  const [cB] = await db.insert(s.clients).values({ userId: B, fullName: 'Müvekkil B' }).returning()
  clientA = cA.id
  const [ka] = await db.insert(s.cases).values({ userId: A, clientId: cA.id, title: 'İşçilik alacağı', caseType: 'iscilik_alacagi', caseNumber: '2026/101', courtName: 'İstanbul 3. İş Mahkemesi', contractedFee: '50000' }).returning()
  const [kb] = await db.insert(s.cases).values({ userId: B, clientId: cB.id, title: 'B davası', caseType: 'kira' }).returning()
  caseA = ka.id
  caseB = kb.id

  const integration = (await import('../src/routes/integration.js')).default
  const keys = (await import('../src/routes/integrationKeys.js')).default
  const proposals = (await import('../src/routes/proposals.js')).default
  const pulse = (await import('../src/routes/pulse.js')).default
  const hearings = (await import('../src/routes/hearings.js')).default
  app = await startApp((e) => {
    e.use('/api/integration', integration)
    e.use('/api/integration-keys', keys)
    e.use('/api/proposals', proposals)
    e.use('/api/pulse', pulse)
    e.use('/api/hearings', hearings)
  })
  call = client(app.base)
  keyA = (await createKey(A, ['read', 'propose'])).key
  readOnlyKeyA = (await createKey(A, ['read'])).key
  keyB = (await createKey(B, ['read', 'propose'])).key
}, 60_000)

afterAll(async () => {
  await app?.close()
  await ctx?.pg.close()
})

describe('rev14 schema', () => {
  it('is idempotent and matches the Drizzle definition of the new tables', async () => {
    await ctx.pg.exec(REV14_INTEGRATION_SQL)
    for (const table of NEW_TABLES) {
      const res = await ctx.pg.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = $1 order by column_name`, [table])
      const defined = Object.values((s as any)[{ api_keys: 'apiKeys', assistant_proposals: 'assistantProposals', integration_events: 'integrationEvents', case_enforcement: 'caseEnforcement' }[table]] as object)
      expect(res.rows.length, table).toBeGreaterThan(0)
      const cols = res.rows.map((r) => r.column_name).sort()
      const expected = (defined as any[]).filter((c) => c && typeof c === 'object' && 'name' in c && 'columnType' in c).map((c) => c.name).sort()
      expect(cols, table).toEqual(expected)
    }
    const [row] = (await ctx.pg.query<{ updated_by_actor: string }>(`select updated_by_actor from cases where id = $1`, [caseA])).rows
    expect(row.updated_by_actor).toBe('avukat')
  })
})

describe('API keys and scopes', () => {
  it('shows the key once and never lists the secret', async () => {
    const res = await call('GET', '/api/integration-keys', { token: tokenFor(A) })
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(JSON.stringify(res.body)).not.toContain(keyA)
    expect(res.body[0]).not.toHaveProperty('keyHash')
  })

  it('rejects missing keys, JWTs and wrong scopes', async () => {
    expect((await call('GET', '/api/integration/cases')).status).toBe(401)
    expect((await call('GET', '/api/integration/cases', { token: tokenFor(A) })).status).toBe(401)
    expect((await call('GET', '/api/integration/cases', { key: 'isbu_sk_' + 'x'.repeat(43) })).status).toBe(401)
    const ro = await call('POST', '/api/integration/proposals', { key: readOnlyKeyA, body: { items: [{}] } })
    expect(ro.status).toBe(403)
    expect((await call('GET', '/api/integration/cases', { key: readOnlyKeyA })).status).toBe(200)
  })

  it('revoked keys stop working and lastUsedAt is tracked', async () => {
    const temp = await createKey(A, ['read'])
    expect((await call('GET', '/api/integration/pulse', { key: temp.key })).status).toBe(200)
    const [used] = await ctx.db.select().from(s.apiKeys).where(eq(s.apiKeys.id, temp.id))
    expect(used.lastUsedAt).not.toBeNull()
    expect((await call('POST', `/api/integration-keys/${temp.id}/revoke`, { token: tokenFor(A) })).status).toBe(200)
    expect((await call('GET', '/api/integration/pulse', { key: temp.key })).status).toBe(401)
    // başka kullanıcı iptal edemez
    expect((await call('POST', `/api/integration-keys/${temp.id}/revoke`, { token: tokenFor(B) })).status).toBe(404)
  })
})

describe('ownership', () => {
  it('scopes reads to the key owner', async () => {
    const list = await call('GET', '/api/integration/cases', { key: keyB })
    expect(list.body.map((c: any) => c.id)).toEqual([caseB])
    expect((await call('GET', `/api/integration/cases/${caseA}`, { key: keyB })).status).toBe(404)
  })

  it('cannot propose against or approve another user\'s data', async () => {
    const res = await call('POST', '/api/integration/proposals', {
      key: keyB,
      body: { items: [{ kind: 'diary_add', external_ref: 'x-1', case_ref: { id: caseA }, payload: { content: 'sızma' }, summary: 's', source: 'asistan', request_id: rid() }] },
    })
    expect(res.body.results[0]).toMatchObject({ status: 'created', deferred_case: true })
    const [p] = await ctx.db.select().from(s.assistantProposals).where(eq(s.assistantProposals.id, res.body.results[0].proposal_id))
    expect(p.caseId).toBeNull()
    // B onaylamaya çalışırsa dava B'nin kapsamında bulunamaz → 409, hiçbir şey yazılmaz
    const approve = await call('POST', `/api/proposals/${p.id}/approve`, { token: tokenFor(B), body: {} })
    expect(approve.status).toBe(409)
    // A bu öneriyi göremez/onaylayamaz
    expect((await call('POST', `/api/proposals/${p.id}/approve`, { token: tokenFor(A), body: {} })).status).toBe(404)
    await call('POST', `/api/proposals/${p.id}/reject`, { token: tokenFor(B), body: { note: 'yanlış' } })
  })
})

describe('proposal lifecycle', () => {
  const hearingItem = (requestId: string, date: string, extra: Record<string, unknown> = {}) => ({
    kind: 'hearing_upsert',
    external_ref: 'uyap:2026/101:durusma:1',
    case_ref: { case_number: '2026/101', court_name: 'istanbul 3. iş mahkemesi' },
    payload: { hearing_date: date, court_room: 'Salon 4', ...extra },
    summary: 'UYAP: yeni duruşma',
    source: 'uyap',
    request_id: requestId,
  })

  it('is idempotent by request_id and keeps a single pending proposal per external_ref', async () => {
    const r1 = rid()
    const first = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [hearingItem(r1, '2026-11-20T10:00:00+03:00')] } })
    expect(first.status).toBe(200)
    expect(first.body.results[0]).toMatchObject({ status: 'created', conflict: false })
    const id = first.body.results[0].proposal_id

    const again = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [hearingItem(r1, '2026-11-20T10:00:00+03:00')] } })
    expect(again.body.results[0]).toMatchObject({ status: 'duplicate', proposal_id: id })

    const r2 = rid()
    const updated = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [hearingItem(r2, '2026-11-21T10:00:00+03:00')] } })
    expect(updated.body.results[0]).toMatchObject({ status: 'updated', proposal_id: id })
    // Eski request_id tekrar gelirse eski içerik geri yazılmaz
    const replay = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [hearingItem(r1, '2026-11-20T10:00:00+03:00')] } })
    expect(replay.body.results[0]).toMatchObject({ status: 'duplicate', proposal_id: id })

    const pending = await ctx.db.select().from(s.assistantProposals).where(and(eq(s.assistantProposals.userId, A), eq(s.assistantProposals.kind, 'hearing_upsert'), eq(s.assistantProposals.status, 'pending')))
    expect(pending).toHaveLength(1)
    expect((pending[0].payload as any).hearing_date).toBe('2026-11-21T10:00:00+03:00')
    expect(pending[0].caseId).toBe(caseA)

    // Hiçbir duruşma henüz yazılmadı
    expect(await ctx.db.select().from(s.caseHearings).where(eq(s.caseHearings.caseId, caseA))).toHaveLength(0)
  })

  it('rejects invalid payloads per item with 207 and details', async () => {
    const res = await call('POST', '/api/integration/proposals', {
      key: keyA,
      body: { items: [{ ...hearingItem(rid(), 'yarın'), external_ref: 'bad' }, { kind: 'status_change', external_ref: 's', payload: { status: 'won' }, summary: 'x', source: 'asistan', request_id: rid() }] },
    })
    expect(res.status).toBe(207)
    expect(res.body.results[0]).toMatchObject({ status: 'error', error: 'Payload doğrulanamadı' })
    expect(res.body.results[1].error).toContain('case_ref gerekli')
  })

  it('applies an approved hearing in one transaction with actor=asistan and audit trail', async () => {
    const [pending] = await ctx.db.select().from(s.assistantProposals).where(and(eq(s.assistantProposals.userId, A), eq(s.assistantProposals.status, 'pending'), eq(s.assistantProposals.kind, 'hearing_upsert')))
    const res = await call('POST', `/api/proposals/${pending.id}/approve`, { token: tokenFor(A), body: { note: 'tamam' } })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'applied', targetType: 'hearing' })
    const [hearing] = await ctx.db.select().from(s.caseHearings).where(eq(s.caseHearings.id, res.body.targetId))
    expect(hearing).toMatchObject({ caseId: caseA, externalRef: 'uyap:2026/101:durusma:1', updatedByActor: 'asistan', courtRoom: 'Salon 4' })
    expect(hearing.hearingDate.toISOString()).toBe('2026-11-21T07:00:00.000Z')
    const diary = await ctx.db.select().from(s.caseDiaryEntries).where(and(eq(s.caseDiaryEntries.caseId, caseA), eq(s.caseDiaryEntries.linkedEntityId, hearing.id)))
    expect(diary[0]).toMatchObject({ entryType: 'hearing_added', updatedByActor: 'asistan' })
    const [p] = await ctx.db.select().from(s.assistantProposals).where(eq(s.assistantProposals.id, pending.id))
    expect(p).toMatchObject({ status: 'applied', appliedTargetId: hearing.id, decidedNote: 'tamam' })
    const events = await ctx.db.select().from(s.integrationEvents).where(eq(s.integrationEvents.proposalId, pending.id))
    expect(events.map((e) => e.action)).toEqual(expect.arrayContaining(['proposal_created', 'proposal_updated', 'proposal_applied']))

    const repeat = await call('POST', `/api/proposals/${pending.id}/approve`, { token: tokenFor(A), body: {} })
    expect(repeat.body).toMatchObject({ status: 'applied', repeated: true })
    expect(await ctx.db.select().from(s.caseHearings).where(eq(s.caseHearings.caseId, caseA))).toHaveLength(1)
  })

  it('flags conflicts when the lawyer edited the target and exposes lawyer changes', async () => {
    const since = new Date(Date.now() - 1000).toISOString()
    const [hearing] = await ctx.db.select().from(s.caseHearings).where(eq(s.caseHearings.caseId, caseA))
    const edit = await call('PUT', `/api/hearings/${hearing.id}`, { token: tokenFor(A), body: { judge: 'Hakim Avukatın Yazdığı' } })
    expect(edit.status).toBe(200)
    expect(edit.body.updatedByActor).toBe('avukat')

    const changes = await call('GET', `/api/integration/changes?since=${encodeURIComponent(since)}`, { key: keyA })
    expect(changes.status).toBe(200)
    expect(changes.body.hearings.map((h: any) => h.id)).toContain(hearing.id)
    expect((await call('GET', '/api/integration/changes', { key: keyA })).status).toBe(400)

    // Avukatın girdiği değeri değiştiren öneri → conflict
    const res = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [hearingItem(rid(), '2026-11-21T10:00:00+03:00', { judge: 'UYAP Hakimi' })] } })
    expect(res.body.results[0]).toMatchObject({ status: 'created', conflict: true })
    // Aynı değerleri öneren (değişiklik yok) → no_change, öneri oluşmaz
    const same = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [hearingItem(rid(), '2026-11-21T07:00:00Z', { judge: 'Hakim Avukatın Yazdığı' })] } })
    expect(same.body.results[0].status).toBe('no_change')
    const [superseded] = await ctx.db.select().from(s.assistantProposals).where(eq(s.assistantProposals.id, res.body.results[0].proposal_id))
    expect(superseded.status).toBe('superseded')
  })

  it('case_upsert fills only empty fields unless overwrite is requested', async () => {
    const item = (overwrite?: string[]) => ({
      kind: 'case_upsert', external_ref: 'uyap:dosya:2026/101', case_ref: { id: caseA },
      payload: { title: 'UYAP başlığı', buro_kodu: '2026-101', description: 'UYAP açıklaması', ...(overwrite ? { overwrite } : {}) },
      summary: 'Dava bilgileri', source: 'uyap', request_id: rid(),
    })
    const res = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [item()] } })
    expect(res.body.results[0]).toMatchObject({ status: 'created', conflict: false })
    const ok = await call('POST', `/api/proposals/${res.body.results[0].proposal_id}/approve`, { token: tokenFor(A), body: {} })
    expect(ok.body.status).toBe('applied')
    const [row] = await ctx.db.select().from(s.cases).where(eq(s.cases.id, caseA))
    expect(row).toMatchObject({ title: 'İşçilik alacağı', buroKodu: '2026-101', description: 'UYAP açıklaması', externalRef: 'uyap:dosya:2026/101', updatedByActor: 'asistan' })

    // overwrite ile başlık değişimi; asistan son düzenleyen olduğundan conflict yok
    const over = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [item(['title'])] } })
    expect(over.body.results[0]).toMatchObject({ status: 'created', conflict: false })
    await call('POST', `/api/proposals/${over.body.results[0].proposal_id}/reject`, { token: tokenFor(A), body: { note: 'başlık kalsın' } })
    const [after] = await ctx.db.select().from(s.cases).where(eq(s.cases.id, caseA))
    expect(after.title).toBe('İşçilik alacağı')
  })

  it('creates a new case and resolves deferred proposals through bulk approval', async () => {
    const items = [
      { kind: 'hearing_upsert', external_ref: 'uyap:2026/555:durusma:1', case_ref: { external_ref: 'uyap:dosya:2026/555' }, payload: { hearing_date: '2026-12-01T09:30:00+03:00' }, summary: 'Duruşma', source: 'uyap', request_id: rid() },
      { kind: 'case_upsert', external_ref: 'uyap:dosya:2026/555', payload: { title: 'Yeni kira davası', client_name: 'Müvekkil A', case_type: 'kira', case_number: '2026/555', court_name: 'Kadıköy 2. Sulh Hukuk' }, summary: 'Yeni dava', source: 'uyap', request_id: rid() },
    ]
    const res = await call('POST', '/api/integration/proposals', { key: keyA, body: { items } })
    expect(res.body.results[0]).toMatchObject({ status: 'created', deferred_case: true })
    const hearingProposal = res.body.results[0].proposal_id
    const caseProposal = res.body.results[1].proposal_id
    // Dava onaylanmadan duruşma onaylanamaz
    expect((await call('POST', `/api/proposals/${hearingProposal}/approve`, { token: tokenFor(A), body: {} })).status).toBe(409)

    const bulk = await call('POST', '/api/proposals/bulk', { token: tokenFor(A), body: { ids: [hearingProposal, caseProposal], action: 'approve' } })
    expect(bulk.body.results.map((r: any) => r.status)).toEqual(['applied', 'applied'])
    const [created] = await ctx.db.select().from(s.cases).where(eq(s.cases.externalRef, 'uyap:dosya:2026/555'))
    expect(created).toMatchObject({ clientId: clientA, caseType: 'kira', updatedByActor: 'asistan', userId: A })
    const hearings = await ctx.db.select().from(s.caseHearings).where(eq(s.caseHearings.caseId, created.id))
    expect(hearings).toHaveLength(1)
  })

  it('stores conditional deadlines without a due date and dedupes diary entries', async () => {
    const res = await call('POST', '/api/integration/proposals', {
      key: keyA,
      body: { items: [
        { kind: 'deadline_upsert', external_ref: 'kalkan:2026/101:istinaf', case_ref: { id: caseA }, payload: { title: 'İstinaf başvurusu', conditional: true, condition: 'Gerekçeli kararın tebliğinden itibaren 2 hafta', legal_basis: 'HMK 345', deadline_severity: 'hak_dusurucu' }, summary: 'Koşullu süre', source: 'kalkan', request_id: rid() },
        { kind: 'deadline_upsert', external_ref: 'kalkan:2026/101:cevap', case_ref: { id: caseA }, payload: { title: 'Cevaba cevap', due_date: '2026-10-15' }, summary: 'Süre', source: 'kalkan', request_id: rid() },
        { kind: 'diary_add', external_ref: 'uyap:evrak:77', case_ref: { id: caseA }, payload: { content: 'Bilirkişi raporu geldi', next_step: 'Rapora itiraz', next_step_due_date: '2026-10-20' }, summary: 'Evrak', source: 'uyap', request_id: rid() },
      ] },
    })
    const ids = res.body.results.map((r: any) => r.proposal_id)
    const bulk = await call('POST', '/api/proposals/bulk', { token: tokenFor(A), body: { ids, action: 'approve' } })
    expect(bulk.body.results.every((r: any) => r.status === 'applied')).toBe(true)
    const [conditional] = await ctx.db.select().from(s.tasks).where(eq(s.tasks.externalRef, 'kalkan:2026/101:istinaf'))
    expect(conditional).toMatchObject({ isDeadline: true, dueDate: null, title: '[Koşullu] İstinaf başvurusu', legalBasis: 'HMK 345', updatedByActor: 'asistan', caseId: caseA })
    expect(conditional.description).toContain('Koşul: Gerekçeli kararın tebliğinden')
    const [dated] = await ctx.db.select().from(s.tasks).where(eq(s.tasks.externalRef, 'kalkan:2026/101:cevap'))
    expect(dated.dueDate?.toISOString()).toBe('2026-10-15T06:00:00.000Z')
    expect(dated.calculatedDueDate).toBe('2026-10-15')

    const again = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [{ kind: 'diary_add', external_ref: 'uyap:evrak:77', case_ref: { id: caseA }, payload: { content: 'Bilirkişi raporu geldi' }, summary: 'Evrak', source: 'uyap', request_id: rid() }] } })
    expect(again.body.results[0].status).toBe('no_change')
  })

  it('marks proposals failed on business-rule errors and keeps invalid edits pending', async () => {
    const res = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [
      { kind: 'case_upsert', external_ref: 'uyap:dosya:yeni-muvekkilsiz', payload: { title: 'Müvekkilsiz dava' }, summary: 'x', source: 'uyap', request_id: rid() },
      { kind: 'task_add', external_ref: 'asistan:gorev:1', case_ref: { id: caseA }, payload: { title: 'Dosyayı incele' }, summary: 'görev', source: 'asistan', request_id: rid() },
    ] } })
    const [failId, taskId] = res.body.results.map((r: any) => r.proposal_id)
    const failed = await call('POST', `/api/proposals/${failId}/approve`, { token: tokenFor(A), body: {} })
    expect(failed.status).toBe(422)
    expect(failed.body).toMatchObject({ status: 'failed' })
    const [fp] = await ctx.db.select().from(s.assistantProposals).where(eq(s.assistantProposals.id, failId))
    expect(fp.status).toBe('failed')
    expect(fp.error).toContain('client_id veya client_name')

    const invalid = await call('POST', `/api/proposals/${taskId}/approve`, { token: tokenFor(A), body: { payload: { title: '' } } })
    expect(invalid.status).toBe(422)
    const [tp] = await ctx.db.select().from(s.assistantProposals).where(eq(s.assistantProposals.id, taskId))
    expect(tp.status).toBe('pending')
    const edited = await call('POST', `/api/proposals/${taskId}/approve`, { token: tokenFor(A), body: { payload: { title: 'Dosyayı avukat başlığıyla incele', priority: 'high' } } })
    expect(edited.body.status).toBe('applied')
    const [task] = await ctx.db.select().from(s.tasks).where(eq(s.tasks.externalRef, 'asistan:gorev:1'))
    expect(task).toMatchObject({ title: 'Dosyayı avukat başlığıyla incele', priority: 'high', isDeadline: false, category: 'dava' })
  })

  it('applies next_step, status_change and enforcement proposals', async () => {
    const res = await call('POST', '/api/integration/proposals', { key: keyA, body: { items: [
      { kind: 'next_step', external_ref: 'asistan:plan:2026/101', case_ref: { id: caseA }, payload: { waiting_for: 'Bilirkişi ek raporu', check_date: '2026-11-01' }, summary: 'plan', source: 'asistan', request_id: rid() },
      { kind: 'enforcement_upsert', external_ref: 'icra:2026/101', case_ref: { id: caseA }, payload: { data: { alacak: { asil: 100000 }, banka: 'haciz yazıldı' }, source_ref: 'icra_ozet.md' }, summary: 'icra', source: 'icra_ozet', request_id: rid() },
      { kind: 'status_change', external_ref: 'uyap:durum:2026/101', case_ref: { id: caseA }, payload: { status: 'istinafta', note: 'İstinaf edildi' }, summary: 'durum', source: 'uyap', request_id: rid() },
    ] } })
    const ids = res.body.results.map((r: any) => r.proposal_id)
    expect(res.body.results[2].conflict).toBe(false) // son düzenleyen asistan
    const bulk = await call('POST', '/api/proposals/bulk', { token: tokenFor(A), body: { ids, action: 'approve' } })
    expect(bulk.body.results.every((r: any) => r.status === 'applied')).toBe(true)
    const [ws] = await ctx.db.select().from(s.caseWorkspaces).where(eq(s.caseWorkspaces.caseId, caseA))
    expect(ws).toMatchObject({ waitingFor: 'Bilirkişi ek raporu', checkDate: '2026-11-01', revision: 1 })
    const [enf] = await ctx.db.select().from(s.caseEnforcement).where(eq(s.caseEnforcement.caseId, caseA))
    expect(enf.data).toEqual({ alacak: { asil: 100000 }, banka: 'haciz yazıldı' })
    const [row] = await ctx.db.select().from(s.cases).where(eq(s.cases.id, caseA))
    expect(row.status).toBe('istinafta')
  })

  it('lists proposals for both sides and serves pulse + reads', async () => {
    const lawyer = await call('GET', '/api/proposals?status=all', { token: tokenFor(A) })
    expect(lawyer.status).toBe(200)
    expect(lawyer.body.every((p: any) => p.caseId === null || typeof p.caseId === 'string')).toBe(true)
    expect((await call('GET', '/api/proposals?status=bogus', { token: tokenFor(A) })).status).toBe(400)
    const assistant = await call('GET', '/api/integration/proposals?status=applied', { key: keyA })
    expect(assistant.body.length).toBeGreaterThan(3)

    const pulse = await call('GET', '/api/pulse', { token: tokenFor(A) })
    expect(pulse.status).toBe(200)
    const item = pulse.body.find((p: any) => p.id === caseA)
    expect(item.nextItem).toBeTruthy()
    expect(item.flags).toContain('tahsilat_bekliyor')
    expect((await call('GET', '/api/integration/pulse', { key: keyA })).body).toHaveLength(pulse.body.length)

    const detail = await call('GET', `/api/integration/cases/${caseA}`, { key: keyA })
    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({ buroKodu: '2026-101', balance: { contractedFee: 50000, collected: 0, remaining: 50000 } })
    expect(detail.body.workspace.waitingFor).toBe('Bilirkişi ek raporu')
    expect(detail.body.openDeadlines.length).toBe(2)
    expect((await call('GET', '/api/integration/deadlines?days=30', { key: keyA })).body.length).toBe(2)
    expect((await call('GET', '/api/integration/hearings/upcoming?days=365', { key: keyA })).body.length).toBe(2)
    const outstanding = await call('GET', '/api/integration/collections/outstanding', { key: keyA })
    expect(outstanding.body.total).toBe(50000)
  })
})
