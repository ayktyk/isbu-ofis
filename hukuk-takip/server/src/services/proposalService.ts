// Asistan öneri yaşam döngüsü: gönder (asistan) → onayla/reddet (avukat) → uygula.
// Kurallar:
//  - request_id ile idempotent (aynı istek tekrar gelirse aynı sonuç döner)
//  - aynı (kullanıcı, tür, external_ref) için tek bekleyen öneri; yenisi onu günceller
//  - hiçbir kayıt avukat onayı olmadan değişmez; onay tek transaction'da uygulanır
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  caseRefSchema,
  detectConflict,
  parseProposalPayload,
  planFieldUpdates,
  proposalItemSchema,
  proposalKindValues,
  type CaseRef,
  type ProposalKind,
} from '@hukuk-takip/shared'
import { db } from '../db/index.js'
import { assistantProposals, cases, integrationEvents, tasks, users, type AssistantProposal, type Case } from '../db/schema.js'
import { syncHearingCalendarSafe, syncTaskCalendarSafe } from '../utils/hearingCalendar.js'
import { applyProposal, type ApplyResult } from './proposalAppliers.js'
import {
  ApplyError,
  HttpError,
  KINDS_NEEDING_CASE,
  findTarget,
  isInsertOnly,
  planOptionsFor,
  proposedComparable,
  resolveCaseRef,
  stripMeta,
  type AnyPayload,
  type Exec,
} from './proposalTargets.js'

export type SubmitStatus = 'created' | 'updated' | 'duplicate' | 'no_change' | 'skipped' | 'error'
export interface SubmitResult {
  index: number
  request_id: string | null
  status: SubmitStatus
  proposal_id?: string
  conflict?: boolean
  deferred_case?: boolean
  error?: string
  details?: unknown
}

function zodDetails(error: { issues: { path: (string | number)[]; message: string }[] }) {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
}

async function lockKey(tx: Exec, key: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`)
}

async function findByRequestId(tx: Exec, requestId: string): Promise<{ userId: string; proposalId: string } | null> {
  const [direct] = await tx.select({ id: assistantProposals.id, userId: assistantProposals.userId }).from(assistantProposals).where(eq(assistantProposals.requestId, requestId)).limit(1)
  if (direct) return { userId: direct.userId, proposalId: direct.id }
  const [event] = await tx
    .select({ userId: integrationEvents.userId, proposalId: integrationEvents.proposalId })
    .from(integrationEvents)
    .where(and(inArray(integrationEvents.action, ['proposal_created', 'proposal_updated', 'proposal_no_change']), sql`${integrationEvents.details}->>'request_id' = ${requestId}`))
    .limit(1)
  return event ? { userId: event.userId, proposalId: event.proposalId ?? '' } : null
}

async function submitOne(userId: string, apiKeyId: string, raw: unknown, index: number): Promise<SubmitResult> {
  const parsedItem = proposalItemSchema.safeParse(raw)
  const requestId = typeof (raw as AnyPayload)?.request_id === 'string' ? (raw as AnyPayload).request_id : null
  if (!parsedItem.success) return { index, request_id: requestId, status: 'error', error: 'Öğe doğrulanamadı', details: zodDetails(parsedItem.error) }
  const item = parsedItem.data
  const parsedPayload = parseProposalPayload(item.kind, item.payload)
  if (!parsedPayload.success) return { index, request_id: item.request_id, status: 'error', error: 'Payload doğrulanamadı', details: zodDetails(parsedPayload.error) }
  const payload = parsedPayload.data as AnyPayload

  try {
    return await db.transaction(async (tx) => {
      await lockKey(tx, `req:${item.request_id}`)
      const seen = await findByRequestId(tx, item.request_id)
      if (seen) {
        if (seen.userId !== userId) throw new HttpError(409, 'Bu request_id başka bir kayıtta kullanılmış.')
        return { index, request_id: item.request_id, status: 'duplicate' as const, proposal_id: seen.proposalId || undefined }
      }
      await lockKey(tx, `prop:${userId}:${item.kind}:${item.external_ref}`)

      let caseRow: Case | null = null
      if (item.case_ref) caseRow = await resolveCaseRef(tx, userId, item.case_ref)
      if (KINDS_NEEDING_CASE.has(item.kind) && !item.case_ref) throw new HttpError(422, `${item.kind} için case_ref gerekli.`)
      const deferred = !!item.case_ref && !caseRow
      // Dava referansı çözülemezse (ör. dava önerisi henüz onaylanmadı) öneri bekletilir;
      // dava onay anında case_ref ile yeniden aranır.

      const target = deferred && item.kind !== 'case_upsert' ? null : await findTarget(tx, userId, item.kind, item.external_ref, payload, caseRow)
      if (target?.archived) {
        return { index, request_id: item.request_id, status: 'skipped' as const, error: 'Hedef kayıt avukat tarafından arşivlenmiş; öneri oluşturulmadı.' }
      }
      const effectiveCaseId = item.kind === 'case_upsert' ? (target?.targetId ?? caseRow?.id ?? null) : caseRow?.id ?? null
      const plan = planFieldUpdates(stripMeta(target?.snapshot ?? null), proposedComparable(item.kind, payload), planOptionsFor(item.kind, payload))
      const conflict = !!target?.row && detectConflict(target.actor, plan)

      const [pending] = await tx
        .select()
        .from(assistantProposals)
        .where(and(eq(assistantProposals.userId, userId), eq(assistantProposals.kind, item.kind), eq(assistantProposals.externalRef, item.external_ref), eq(assistantProposals.status, 'pending')))
        .for('update')

      const noChange =
        !!target?.row &&
        (isInsertOnly(item.kind, payload) ||
          (Object.keys(plan.changes).length === 0 && !(item.kind === 'case_upsert' && !target.row.externalRef)))
      if (noChange) {
        if (pending) {
          await tx.update(assistantProposals).set({ status: 'superseded', decidedAt: new Date(), updatedAt: new Date(), decidedNote: 'Kayıt zaten güncel; öneri gereksiz kaldı.' }).where(eq(assistantProposals.id, pending.id))
        }
        await tx.insert(integrationEvents).values({ userId, actor: 'asistan', apiKeyId, action: 'proposal_no_change', targetType: target!.targetType, targetId: target!.targetId, proposalId: pending?.id ?? null, details: { request_id: item.request_id, kind: item.kind, external_ref: item.external_ref } })
        return { index, request_id: item.request_id, status: 'no_change' as const, proposal_id: pending?.id }
      }

      const values = {
        caseId: effectiveCaseId,
        caseRef: item.case_ref ?? null,
        targetType: target?.targetType ?? null,
        targetId: target?.targetId ?? null,
        payload,
        before: target?.snapshot ?? null,
        conflict,
        summary: item.summary,
        reason: item.reason ?? null,
        source: item.source,
        requestId: item.request_id,
        apiKeyId,
        updatedAt: new Date(),
      }
      let proposalId: string
      let status: 'created' | 'updated'
      if (pending) {
        await tx.update(assistantProposals).set(values).where(eq(assistantProposals.id, pending.id))
        proposalId = pending.id
        status = 'updated'
      } else {
        const [row] = await tx.insert(assistantProposals).values({ ...values, userId, kind: item.kind, externalRef: item.external_ref }).returning({ id: assistantProposals.id })
        proposalId = row.id
        status = 'created'
      }
      await tx.insert(integrationEvents).values({
        userId, actor: 'asistan', apiKeyId, action: `proposal_${status}`, targetType: values.targetType, targetId: values.targetId, proposalId,
        details: { request_id: item.request_id, kind: item.kind, external_ref: item.external_ref, previous_request_id: pending?.requestId ?? null, conflict, changed_fields: Object.keys(plan.changes) },
      })
      return { index, request_id: item.request_id, status, proposal_id: proposalId, conflict, deferred_case: deferred || undefined }
    })
  } catch (error) {
    if (error instanceof HttpError) return { index, request_id: item.request_id, status: 'error', error: error.message }
    throw error
  }
}

export async function submitProposals(userId: string, apiKeyId: string, items: unknown[]): Promise<SubmitResult[]> {
  const results: SubmitResult[] = []
  // Sıralı: aynı partideki öğeler birbirini görebilsin (ör. aynı anahtarın güncellenmesi).
  for (let i = 0; i < items.length; i++) results.push(await submitOne(userId, apiKeyId, items[i], i))
  return results
}

async function assertReviewer(exec: Exec, userId: string) {
  const [user] = await exec.select({ role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, userId)).limit(1)
  if (!user || !user.isActive || !['admin', 'lawyer'].includes(user.role)) throw new HttpError(403, 'Önerileri yalnızca avukat onaylayabilir.')
}

async function loadCaseForProposal(tx: Exec, userId: string, proposal: AssistantProposal): Promise<Case | null> {
  if (proposal.caseId) {
    const caseRow = await resolveCaseRef(tx, userId, { id: proposal.caseId })
    if (!caseRow) throw new ApplyError('Önerinin bağlı olduğu dava bulunamadı veya arşivlenmiş.')
    return caseRow
  }
  if (proposal.caseRef) {
    const ref = caseRefSchema.safeParse(proposal.caseRef)
    const caseRow = ref.success ? await resolveCaseRef(tx, userId, ref.data as CaseRef) : null
    if (!caseRow && proposal.kind !== 'case_upsert') {
      throw new HttpError(409, 'Bu önerinin davası henüz uygulamada yok. Önce ilgili dava önerisini onaylayın.')
    }
    return caseRow
  }
  return null
}

export interface DecisionResult {
  id: string
  status: 'applied' | 'rejected' | 'failed'
  repeated?: boolean
  targetType?: string
  targetId?: string
  conflict?: boolean
  error?: string
}

export async function approveProposal(userId: string, proposalId: string, editedPayload?: AnyPayload, note?: string): Promise<DecisionResult> {
  let calendar: ApplyResult['calendar'] | undefined
  let failure: string | null = null
  const result = await db.transaction(async (tx): Promise<DecisionResult | null> => {
    await assertReviewer(tx, userId)
    const [proposal] = await tx.select().from(assistantProposals).where(and(eq(assistantProposals.id, proposalId), eq(assistantProposals.userId, userId))).for('update')
    if (!proposal) throw new HttpError(404, 'Öneri bulunamadı.')
    if (proposal.status === 'applied') return { id: proposal.id, status: 'applied', repeated: true, targetType: proposal.targetType ?? undefined, targetId: proposal.appliedTargetId ?? undefined }
    if (proposal.status !== 'pending') throw new HttpError(409, `Öneri zaten sonuçlanmış (${proposal.status}).`)
    const kind = proposal.kind as ProposalKind
    if (!proposalKindValues.includes(kind)) throw new HttpError(422, 'Bilinmeyen öneri türü.')
    const parsed = parseProposalPayload(kind, editedPayload ?? proposal.payload)
    if (!parsed.success) throw new HttpError(422, 'Düzenlenen öneri geçersiz.', zodDetails(parsed.error))
    const payload = parsed.data as AnyPayload

    try {
      // Uygulama hatası transaction'ı bozmasın diye savepoint içinde çalışır.
      const applied = await tx.transaction(async (sp) => {
        const caseRow = await loadCaseForProposal(sp, userId, proposal)
        if (KINDS_NEEDING_CASE.has(kind) && !caseRow) throw new ApplyError('Dava bulunamadı.')
        const res = await applyProposal(sp, { userId, kind, externalRef: proposal.externalRef, payload, caseRow, summary: proposal.summary })
        return { res, caseRow }
      })
      const { res } = applied
      calendar = res.calendar
      const now = new Date()
      await tx
        .update(assistantProposals)
        .set({
          status: 'applied', decidedAt: now, appliedAt: now, updatedAt: now, decidedNote: note ?? null,
          payload, appliedTargetId: res.targetId, targetType: res.targetType, targetId: res.targetId,
          caseId: res.targetType === 'case' ? res.targetId : (applied.caseRow?.id ?? proposal.caseId), error: null,
        })
        .where(eq(assistantProposals.id, proposal.id))
      await tx.insert(integrationEvents).values({
        userId, actor: 'avukat', action: 'proposal_applied', targetType: res.targetType, targetId: res.targetId, proposalId: proposal.id,
        details: { kind, edited: !!editedPayload, original_payload: editedPayload ? proposal.payload : undefined, created: res.created, changed_fields: res.changedFields, overwritten_fields: res.overwrittenFields, conflict: res.conflictAtApply, note: note ?? null },
      })
      return { id: proposal.id, status: 'applied', targetType: res.targetType, targetId: res.targetId, conflict: res.conflictAtApply }
    } catch (error) {
      if (error instanceof HttpError) throw error
      failure = error instanceof Error ? error.message : String(error)
      if (!(error instanceof ApplyError)) console.error('[proposals] uygulama hatası', proposal.id, error)
      const now = new Date()
      await tx.update(assistantProposals).set({ status: 'failed', decidedAt: now, updatedAt: now, decidedNote: note ?? null, error: failure.slice(0, 2000) }).where(eq(assistantProposals.id, proposal.id))
      await tx.insert(integrationEvents).values({ userId, actor: 'avukat', action: 'proposal_failed', targetType: proposal.targetType, targetId: proposal.targetId, proposalId: proposal.id, details: { kind, error: failure.slice(0, 2000) } })
      return { id: proposal.id, status: 'failed', error: failure }
    }
  })

  if (result?.status === 'applied' && !result.repeated && calendar) {
    if (calendar.hearingId) await syncHearingCalendarSafe(userId, calendar.hearingId, 'assistant')
    if (calendar.taskId) {
      const [task] = await db.select().from(tasks).where(eq(tasks.id, calendar.taskId)).limit(1)
      if (task) {
        const [caseRow] = task.caseId ? await db.select({ title: cases.title }).from(cases).where(eq(cases.id, task.caseId)).limit(1) : []
        await syncTaskCalendarSafe(task, caseRow?.title ?? null, 'assistant')
      }
    }
  }
  return result!
}

export async function rejectProposal(userId: string, proposalId: string, note?: string): Promise<DecisionResult> {
  return db.transaction(async (tx) => {
    await assertReviewer(tx, userId)
    const [proposal] = await tx.select().from(assistantProposals).where(and(eq(assistantProposals.id, proposalId), eq(assistantProposals.userId, userId))).for('update')
    if (!proposal) throw new HttpError(404, 'Öneri bulunamadı.')
    if (proposal.status === 'rejected') return { id: proposal.id, status: 'rejected' as const, repeated: true }
    if (proposal.status !== 'pending') throw new HttpError(409, `Öneri zaten sonuçlanmış (${proposal.status}).`)
    const now = new Date()
    await tx.update(assistantProposals).set({ status: 'rejected', decidedAt: now, updatedAt: now, decidedNote: note ?? null }).where(eq(assistantProposals.id, proposal.id))
    await tx.insert(integrationEvents).values({ userId, actor: 'avukat', action: 'proposal_rejected', targetType: proposal.targetType, targetId: proposal.targetId, proposalId: proposal.id, details: { kind: proposal.kind, note: note ?? null } })
    return { id: proposal.id, status: 'rejected' as const }
  })
}

const KIND_ORDER: Record<string, number> = { case_upsert: 0, status_change: 1 }

export async function bulkDecide(userId: string, ids: string[], action: 'approve' | 'reject', note?: string) {
  const rows = await db.select({ id: assistantProposals.id, kind: assistantProposals.kind, createdAt: assistantProposals.createdAt }).from(assistantProposals).where(and(eq(assistantProposals.userId, userId), inArray(assistantProposals.id, ids)))
  // Davalar önce: aynı partideki duruşma/süre önerileri yeni davayı bulabilsin.
  const ordered = [...rows].sort((a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) || a.createdAt.getTime() - b.createdAt.getTime())
  const results: Array<DecisionResult | { id: string; status: 'error'; error: string }> = []
  for (const row of ordered) {
    try {
      results.push(action === 'approve' ? await approveProposal(userId, row.id, undefined, note) : await rejectProposal(userId, row.id, note))
    } catch (error) {
      results.push({ id: row.id, status: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  }
  const found = new Set(rows.map((r) => r.id))
  for (const id of ids) if (!found.has(id)) results.push({ id, status: 'error', error: 'Öneri bulunamadı.' })
  return results
}

export async function listProposals(userId: string, filters: { status?: string; kind?: string; caseId?: string; since?: Date; limit?: number }) {
  const conditions = [eq(assistantProposals.userId, userId)]
  if (filters.status && filters.status !== 'all') conditions.push(eq(assistantProposals.status, filters.status))
  if (filters.kind) conditions.push(eq(assistantProposals.kind, filters.kind))
  if (filters.caseId) conditions.push(eq(assistantProposals.caseId, filters.caseId))
  if (filters.since) conditions.push(sql`${assistantProposals.updatedAt} > ${filters.since}`)
  return db
    .select({
      id: assistantProposals.id,
      kind: assistantProposals.kind,
      status: assistantProposals.status,
      caseId: assistantProposals.caseId,
      caseTitle: cases.title,
      caseNumber: cases.caseNumber,
      caseRef: assistantProposals.caseRef,
      targetType: assistantProposals.targetType,
      targetId: assistantProposals.targetId,
      externalRef: assistantProposals.externalRef,
      payload: assistantProposals.payload,
      before: assistantProposals.before,
      conflict: assistantProposals.conflict,
      summary: assistantProposals.summary,
      reason: assistantProposals.reason,
      source: assistantProposals.source,
      requestId: assistantProposals.requestId,
      decidedNote: assistantProposals.decidedNote,
      error: assistantProposals.error,
      appliedTargetId: assistantProposals.appliedTargetId,
      createdAt: assistantProposals.createdAt,
      updatedAt: assistantProposals.updatedAt,
      decidedAt: assistantProposals.decidedAt,
      appliedAt: assistantProposals.appliedAt,
    })
    .from(assistantProposals)
    .leftJoin(cases, eq(assistantProposals.caseId, cases.id))
    .where(and(...conditions))
    .orderBy(desc(assistantProposals.conflict), desc(assistantProposals.createdAt))
    .limit(Math.min(filters.limit ?? 200, 500))
}
