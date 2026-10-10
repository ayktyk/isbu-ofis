// Asistan tarafı: /api/integration/* — YALNIZCA API anahtarıyla (JWT kabul edilmez).
//   scope 'read'    → okuma uçları
//   scope 'propose' → öneri gönderme (hiçbir kayıt doğrudan değişmez)
import { Router } from 'express'
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql, type AnyColumn } from 'drizzle-orm'
import { z } from 'zod'
import { proposalBatchSchema, proposalStatusValues } from '@hukuk-takip/shared'
import { db } from '../db/index.js'
import {
  caseDiaryEntries,
  caseEnforcement,
  caseFeeInstallments,
  caseHearings,
  cases,
  caseWorkspaces,
  clients,
  collections,
  tasks,
} from '../db/schema.js'
import { authenticateApiKey, requireScope } from '../middleware/apiKeyAuth.js'
import { validate } from '../middleware/validate.js'
import { listProposals, submitProposals } from '../services/proposalService.js'
import { getOutstandingCaseFees, getOutstandingMediationFees, sumOutstanding } from '../utils/outstandingFees.js'
import { loadCasePulse } from '../utils/pulseLoader.js'
import { getPositiveInt, getSingleValue } from '../utils/request.js'

const router = Router()
router.use(authenticateApiKey)

const caseColumns = {
  id: cases.id,
  title: cases.title,
  status: cases.status,
  caseType: cases.caseType,
  customCaseType: cases.customCaseType,
  caseNumber: cases.caseNumber,
  courtName: cases.courtName,
  buroKodu: cases.buroKodu,
  externalRef: cases.externalRef,
  isCmkAssignment: cases.isCmkAssignment,
  clientId: cases.clientId,
  clientName: clients.fullName,
  startDate: cases.startDate,
  closeDate: cases.closeDate,
  contractedFee: cases.contractedFee,
  currency: cases.currency,
  updatedAt: cases.updatedAt,
  updatedByActor: cases.updatedByActor,
}

function userOf(req: { integration?: { userId: string } }) {
  return req.integration!.userId
}

// ─── Okuma ────────────────────────────────────────────────────────────────────

router.get('/cases', requireScope('read'), async (req, res) => {
  const userId = userOf(req)
  const includeClosed = getSingleValue(req.query.include_closed) === '1'
  const conditions = [eq(cases.userId, userId), isNull(cases.archivedAt)]
  if (!includeClosed) conditions.push(sql`${cases.status} <> 'closed'`)
  const rows = await db
    .select(caseColumns)
    .from(cases)
    .leftJoin(clients, eq(cases.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(desc(cases.updatedAt))
  const ids = rows.map((r) => r.id)
  const [workspaces, pulse] = await Promise.all([
    ids.length ? db.select().from(caseWorkspaces).where(inArray(caseWorkspaces.caseId, ids)) : [],
    loadCasePulse(userId),
  ])
  const wsBy = new Map(workspaces.map((w) => [w.caseId, w]))
  const pulseBy = new Map(pulse.filter((p) => p.type === 'case').map((p) => [p.id, p]))
  res.json(
    rows.map((row) => {
      const p = pulseBy.get(row.id)
      const ws = wsBy.get(row.id)
      return {
        ...row,
        workspace: ws ? { stage: ws.stage, waitingFor: ws.waitingFor, checkDate: ws.checkDate, revision: ws.revision } : null,
        nextItem: p?.nextItem ?? null,
        openBalance: p?.openBalance ?? null,
        flags: p?.flags ?? [],
        lastActivityAt: p?.lastActivityAt ?? null,
      }
    })
  )
})

router.get('/cases/:id', requireScope('read'), async (req, res) => {
  const userId = userOf(req)
  const id = z.string().uuid().safeParse(req.params.id)
  if (!id.success) {
    res.status(400).json({ error: 'Geçersiz dava id.' })
    return
  }
  const [row] = await db
    .select(caseColumns)
    .from(cases)
    .leftJoin(clients, eq(cases.clientId, clients.id))
    .where(and(eq(cases.id, id.data), eq(cases.userId, userId), isNull(cases.archivedAt)))
    .limit(1)
  if (!row) {
    res.status(404).json({ error: 'Dava bulunamadı.' })
    return
  }
  const [[workspace], [enforcement], hearings, openTasks, diary, [collected], installments] = await Promise.all([
    db.select().from(caseWorkspaces).where(eq(caseWorkspaces.caseId, row.id)),
    db.select().from(caseEnforcement).where(eq(caseEnforcement.caseId, row.id)),
    db
      .select({ id: caseHearings.id, hearingDate: caseHearings.hearingDate, courtRoom: caseHearings.courtRoom, judge: caseHearings.judge, result: caseHearings.result, notes: caseHearings.notes, externalRef: caseHearings.externalRef, updatedByActor: caseHearings.updatedByActor })
      .from(caseHearings)
      .where(and(eq(caseHearings.caseId, row.id), isNull(caseHearings.archivedAt)))
      .orderBy(asc(caseHearings.hearingDate)),
    db
      .select({ id: tasks.id, title: tasks.title, description: tasks.description, status: tasks.status, priority: tasks.priority, dueDate: tasks.dueDate, isDeadline: tasks.isDeadline, legalBasis: tasks.legalBasis, externalRef: tasks.externalRef, updatedByActor: tasks.updatedByActor })
      .from(tasks)
      .where(and(eq(tasks.caseId, row.id), eq(tasks.userId, userId), isNull(tasks.archivedAt), inArray(tasks.status, ['pending', 'in_progress'])))
      .orderBy(sql`${tasks.dueDate} ASC NULLS LAST`),
    db
      .select({ id: caseDiaryEntries.id, entryType: caseDiaryEntries.entryType, title: caseDiaryEntries.title, content: caseDiaryEntries.content, nextStep: caseDiaryEntries.nextStep, nextStepDueDate: caseDiaryEntries.nextStepDueDate, nextStepDone: caseDiaryEntries.nextStepDone, occurredAt: caseDiaryEntries.occurredAt, externalRef: caseDiaryEntries.externalRef, updatedByActor: caseDiaryEntries.updatedByActor })
      .from(caseDiaryEntries)
      .where(and(eq(caseDiaryEntries.caseId, row.id), isNull(caseDiaryEntries.archivedAt)))
      .orderBy(desc(caseDiaryEntries.occurredAt))
      .limit(30),
    db
      .select({ total: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text` })
      .from(collections)
      .where(and(eq(collections.caseId, row.id), isNull(collections.archivedAt))),
    db
      .select({ seq: caseFeeInstallments.seq, amount: caseFeeInstallments.amount, dueDate: caseFeeInstallments.dueDate, status: caseFeeInstallments.status })
      .from(caseFeeInstallments)
      .where(and(eq(caseFeeInstallments.caseId, row.id), isNull(caseFeeInstallments.archivedAt)))
      .orderBy(asc(caseFeeInstallments.seq)),
  ])
  const now = Date.now()
  const fee = row.contractedFee ? Number(row.contractedFee) : null
  const totalCollected = Number(collected?.total ?? 0)
  const pending = await listProposals(userId, { status: 'pending', caseId: row.id, limit: 100 })
  res.json({
    ...row,
    workspace: workspace ?? null,
    enforcement: enforcement ?? null,
    nextHearing: hearings.find((h) => h.result === 'pending' && h.hearingDate.getTime() >= now) ?? null,
    hearings,
    openTasks,
    openDeadlines: openTasks.filter((t) => t.isDeadline),
    diary,
    balance: {
      contractedFee: fee,
      collected: totalCollected,
      remaining: fee !== null ? Math.round((fee - totalCollected) * 100) / 100 : null,
      installments,
    },
    pendingProposals: pending,
  })
})

router.get('/hearings/upcoming', requireScope('read'), async (req, res) => {
  const userId = userOf(req)
  const days = Math.min(getPositiveInt(req.query.days, 30), 365)
  const from = new Date()
  const until = new Date(from.getTime() + days * 86_400_000)
  const rows = await db
    .select({
      id: caseHearings.id, caseId: caseHearings.caseId, hearingDate: caseHearings.hearingDate,
      courtRoom: caseHearings.courtRoom, judge: caseHearings.judge, result: caseHearings.result,
      externalRef: caseHearings.externalRef, caseTitle: cases.title, caseNumber: cases.caseNumber,
      courtName: cases.courtName, buroKodu: cases.buroKodu, caseExternalRef: cases.externalRef, clientName: clients.fullName,
    })
    .from(caseHearings)
    .innerJoin(cases, eq(caseHearings.caseId, cases.id))
    .leftJoin(clients, eq(cases.clientId, clients.id))
    .where(and(eq(cases.userId, userId), isNull(cases.archivedAt), isNull(caseHearings.archivedAt), eq(caseHearings.result, 'pending'), gte(caseHearings.hearingDate, from), lte(caseHearings.hearingDate, until)))
    .orderBy(asc(caseHearings.hearingDate))
  res.json(rows)
})

router.get('/deadlines', requireScope('read'), async (req, res) => {
  const userId = userOf(req)
  const days = Math.min(getPositiveInt(req.query.days, 60), 3650)
  const until = new Date(Date.now() + days * 86_400_000)
  const rows = await db
    .select({
      id: tasks.id, caseId: tasks.caseId, title: tasks.title, description: tasks.description, status: tasks.status,
      dueDate: tasks.dueDate, legalBasis: tasks.legalBasis, deadlineSeverity: tasks.deadlineSeverity,
      triggerEventDate: tasks.triggerEventDate, externalRef: tasks.externalRef, updatedByActor: tasks.updatedByActor,
      caseTitle: cases.title, caseNumber: cases.caseNumber, buroKodu: cases.buroKodu,
    })
    .from(tasks)
    .leftJoin(cases, eq(tasks.caseId, cases.id))
    .where(and(eq(tasks.userId, userId), eq(tasks.isDeadline, true), isNull(tasks.archivedAt), inArray(tasks.status, ['pending', 'in_progress']), or(isNull(tasks.dueDate), lte(tasks.dueDate, until))))
    .orderBy(sql`${tasks.dueDate} ASC NULLS LAST`)
  res.json(rows)
})

router.get('/collections/outstanding', requireScope('read'), async (req, res) => {
  const userId = userOf(req)
  const [caseRows, mediationRows] = await Promise.all([getOutstandingCaseFees(userId), getOutstandingMediationFees(userId)])
  res.json({ cases: caseRows, mediations: mediationRows, total: sumOutstanding([...caseRows, ...mediationRows]) })
})

router.get('/pulse', requireScope('read'), async (req, res) => {
  res.json(await loadCasePulse(userOf(req)))
})

// Avukatın uygulamada yaptığı değişiklikler (asistan kendi önerilerini tekrar görmesin).
// Keyset sayfalama: her tablo (updated_at, id) sırasıyla okunur; yanıttaki opak
// next_cursor bir sonraki çağrıda ?cursor= olarak verilir. Eşit zaman damgalı
// satırlar atlanmaz/tekrarlanmaz (zaman damgası mikro-saniye hassasiyetle taşınır).
const ZERO_UUID = '00000000-0000-0000-0000-000000000000'
const CHANGE_TABLES = ['cases', 'hearings', 'tasks', 'diary'] as const
type ChangeTable = (typeof CHANGE_TABLES)[number]
type ChangePos = { t: string; i: string }
type ChangeCursor = Record<ChangeTable, ChangePos>

const changePosSchema = z.object({
  t: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/),
  i: z.string().uuid(),
})
const changeCursorSchema = z.object({
  v: z.literal(1),
  p: z.object({ cases: changePosSchema, hearings: changePosSchema, tasks: changePosSchema, diary: changePosSchema }),
})

function encodeChangeCursor(cursor: ChangeCursor): string {
  return Buffer.from(JSON.stringify({ v: 1, p: cursor }), 'utf8').toString('base64url')
}

function decodeChangeCursor(raw: string): ChangeCursor | null {
  try {
    const parsed = changeCursorSchema.safeParse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')))
    return parsed.success ? parsed.data.p : null
  } catch {
    return null
  }
}

// updated_at "timestamp" (saat dilimsiz, UTC) — mikro-saniyeyi kaybetmeden metne çevrilir.
const cursorTs = (column: AnyColumn) => sql<string>`to_char(${column}, 'YYYY-MM-DD"T"HH24:MI:SS.US')`
const afterPos = (updatedAt: AnyColumn, id: AnyColumn, pos: ChangePos) => sql`(${updatedAt}, ${id}) > (${pos.t}::timestamp, ${pos.i}::uuid)`

router.get('/changes', requireScope('read'), async (req, res) => {
  const userId = userOf(req)
  const rawCursor = getSingleValue(req.query.cursor)
  const rawSince = getSingleValue(req.query.since)
  let start: ChangeCursor
  let since: Date | null = null
  if (rawCursor) {
    const decoded = decodeChangeCursor(rawCursor)
    if (!decoded) {
      res.status(400).json({ error: 'cursor geçersiz; bir önceki yanıtın next_cursor değerini olduğu gibi gönderin.' })
      return
    }
    start = decoded
  } else {
    since = rawSince ? new Date(rawSince) : null
    if (!since || !Number.isFinite(since.getTime())) {
      res.status(400).json({ error: 'since parametresi ISO tarih olmalı (örn. 2026-10-01T00:00:00Z) ya da cursor verilmeli.' })
      return
    }
    const pos = { t: since.toISOString().replace('Z', ''), i: ZERO_UUID }
    start = { cases: pos, hearings: pos, tasks: pos, diary: pos }
  }
  const until = new Date()
  const limit = Math.min(getPositiveInt(req.query.limit, 500), 500)
  const [caseRows, hearingRows, taskRows, diaryRows] = await Promise.all([
    db.select({ ...caseColumns, _ts: cursorTs(cases.updatedAt) }).from(cases).leftJoin(clients, eq(cases.clientId, clients.id))
      .where(and(eq(cases.userId, userId), eq(cases.updatedByActor, 'avukat'), afterPos(cases.updatedAt, cases.id, start.cases)))
      .orderBy(asc(cases.updatedAt), asc(cases.id)).limit(limit),
    db.select({ id: caseHearings.id, caseId: caseHearings.caseId, hearingDate: caseHearings.hearingDate, courtRoom: caseHearings.courtRoom, judge: caseHearings.judge, result: caseHearings.result, notes: caseHearings.notes, externalRef: caseHearings.externalRef, archivedAt: caseHearings.archivedAt, updatedAt: caseHearings.updatedAt, _ts: cursorTs(caseHearings.updatedAt) })
      .from(caseHearings).innerJoin(cases, eq(caseHearings.caseId, cases.id))
      .where(and(eq(cases.userId, userId), eq(caseHearings.updatedByActor, 'avukat'), afterPos(caseHearings.updatedAt, caseHearings.id, start.hearings)))
      .orderBy(asc(caseHearings.updatedAt), asc(caseHearings.id)).limit(limit),
    db.select({ id: tasks.id, caseId: tasks.caseId, title: tasks.title, status: tasks.status, dueDate: tasks.dueDate, isDeadline: tasks.isDeadline, externalRef: tasks.externalRef, archivedAt: tasks.archivedAt, updatedAt: tasks.updatedAt, _ts: cursorTs(tasks.updatedAt) })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.updatedByActor, 'avukat'), afterPos(tasks.updatedAt, tasks.id, start.tasks)))
      .orderBy(asc(tasks.updatedAt), asc(tasks.id)).limit(limit),
    db.select({ id: caseDiaryEntries.id, caseId: caseDiaryEntries.caseId, entryType: caseDiaryEntries.entryType, title: caseDiaryEntries.title, content: caseDiaryEntries.content, nextStep: caseDiaryEntries.nextStep, nextStepDueDate: caseDiaryEntries.nextStepDueDate, nextStepDone: caseDiaryEntries.nextStepDone, occurredAt: caseDiaryEntries.occurredAt, externalRef: caseDiaryEntries.externalRef, archivedAt: caseDiaryEntries.archivedAt, updatedAt: caseDiaryEntries.updatedAt, _ts: cursorTs(caseDiaryEntries.updatedAt) })
      .from(caseDiaryEntries).innerJoin(cases, eq(caseDiaryEntries.caseId, cases.id))
      .where(and(eq(cases.userId, userId), eq(caseDiaryEntries.updatedByActor, 'avukat'), afterPos(caseDiaryEntries.updatedAt, caseDiaryEntries.id, start.diary)))
      .orderBy(asc(caseDiaryEntries.updatedAt), asc(caseDiaryEntries.id)).limit(limit),
  ])
  const lastPos = (rows: Array<{ id: string; _ts: string }>, fallback: ChangePos): ChangePos => {
    const last = rows[rows.length - 1]
    return last ? { t: last._ts, i: last.id } : fallback
  }
  const next: ChangeCursor = {
    cases: lastPos(caseRows, start.cases),
    hearings: lastPos(hearingRows, start.hearings),
    tasks: lastPos(taskRows, start.tasks),
    diary: lastPos(diaryRows, start.diary),
  }
  const strip = <T extends { _ts: string }>(rows: T[]) => rows.map(({ _ts: _drop, ...rest }) => rest)
  const truncated = [caseRows, hearingRows, taskRows, diaryRows].some((rows) => rows.length === limit)
  res.json({
    since: since ? since.toISOString() : null,
    // Geriye uyumluluk: eski istemciler until'i bir sonraki since olarak kullanıyordu.
    // truncated=true iken bu satır kaçırır; istemciler next_cursor kullanmalı.
    until: until.toISOString(),
    truncated,
    next_cursor: encodeChangeCursor(next),
    cases: strip(caseRows),
    hearings: strip(hearingRows),
    tasks: strip(taskRows),
    diary: strip(diaryRows),
  })
})

router.get('/proposals', requireScope('read'), async (req, res) => {
  const status = getSingleValue(req.query.status) || 'all'
  if (status !== 'all' && !(proposalStatusValues as readonly string[]).includes(status)) {
    res.status(400).json({ error: 'Geçersiz durum filtresi.' })
    return
  }
  const rawSince = getSingleValue(req.query.since)
  const since = rawSince ? new Date(rawSince) : undefined
  if (since && !Number.isFinite(since.getTime())) {
    res.status(400).json({ error: 'since ISO tarih olmalı.' })
    return
  }
  res.json(await listProposals(userOf(req), { status, since }))
})

// ─── Öneri gönderme ───────────────────────────────────────────────────────────

router.post('/proposals', requireScope('propose'), validate(proposalBatchSchema), async (req, res) => {
  const { items } = proposalBatchSchema.parse(req.body)
  const results = await submitProposals(userOf(req), req.integration!.apiKeyId, items)
  const counts = results.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
  res.status(results.some((r) => r.status === 'error') ? 207 : 200).json({ counts, results })
})

export default router
