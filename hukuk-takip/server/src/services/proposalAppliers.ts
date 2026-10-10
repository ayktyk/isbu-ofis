// Onaylanan önerinin tür bazında uygulanması. Tamamı çağıranın açtığı TEK
// transaction içinde çalışır; takvim senkronu commit sonrasında yapılır.
// Hiçbir uygulayıcı satır silmez; yalnızca ekler veya günceller.
import { and, eq, isNull, sql } from 'drizzle-orm'
import { detectConflict, mergeJsonData, planFieldUpdates, type ProposalKind } from '@hukuk-takip/shared'
import {
  caseDiaryEntries,
  caseEnforcement,
  caseHearings,
  cases,
  caseWorkspaces,
  clients,
  tasks,
  type Case,
} from '../db/schema.js'
import {
  ApplyError,
  TIMESTAMP_KEYS,
  findTarget,
  planOptionsFor,
  proposedComparable,
  stripMeta,
  type AnyPayload,
  type Exec,
} from './proposalTargets.js'

const ACTOR = 'asistan'

const CASE_STATUS_LABELS: Record<string, string> = {
  active: 'Aktif', istinafta: 'İstinafta', yargıtayda: 'Yargıtayda', passive: 'Pasif',
  closed: 'Kapandı', won: 'Kazanıldı', lost: 'Kaybedildi', settled: 'Uzlaşıldı',
}

export interface ApplyContext {
  userId: string
  kind: ProposalKind
  externalRef: string
  payload: AnyPayload
  caseRow: Case | null
  summary: string
}

export interface ApplyResult {
  targetType: string
  targetId: string
  created: boolean
  changedFields: string[]
  overwrittenFields: string[]
  conflictAtApply: boolean
  calendar?: { hearingId?: string; taskId?: string }
}

function toColumns(changes: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(changes)) {
    out[key] = TIMESTAMP_KEYS.has(key) && value ? new Date(String(value)) : value
  }
  return out
}

// Doğal anahtarla bulunan (external_ref'siz) kayda öneri anahtarı yazılır; yinelenen kayıt açılmaz.
function refLink(target: { linkRef?: boolean; row: AnyPayload | null }, externalRef: string): { externalRef?: string } {
  return target.linkRef && target.row && !target.row.externalRef ? { externalRef } : {}
}

async function diary(tx: Exec, ctx: ApplyContext, caseId: string, values: { entryType: 'manual' | 'hearing_added' | 'hearing_updated' | 'task_added' | 'status_changed'; title: string; content?: string | null; linkedEntityType?: string; linkedEntityId?: string }) {
  await tx.insert(caseDiaryEntries).values({
    caseId,
    userId: ctx.userId,
    entryType: values.entryType,
    title: values.title,
    content: values.content ?? null,
    linkedEntityType: values.linkedEntityType ?? null,
    linkedEntityId: values.linkedEntityId ?? null,
    updatedByActor: ACTOR,
  })
}

async function findOrCreateClient(tx: Exec, userId: string, payload: AnyPayload): Promise<string> {
  if (payload.client_id) {
    const [row] = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, payload.client_id), eq(clients.userId, userId), isNull(clients.archivedAt))).limit(1)
    if (!row) throw new ApplyError('Belirtilen müvekkil bulunamadı.')
    return row.id
  }
  if (!payload.client_name) throw new ApplyError('Yeni dava için client_id veya client_name gerekli.')
  const matches = await tx
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.userId, userId), isNull(clients.archivedAt), sql`lower(trim(${clients.fullName})) = lower(trim(${payload.client_name}))`))
    .limit(2)
  if (matches.length > 1) throw new ApplyError(`"${payload.client_name}" adında birden fazla müvekkil var; client_id ile düzenleyip onaylayın.`)
  if (matches[0]) return matches[0].id
  const [created] = await tx.insert(clients).values({ userId, fullName: payload.client_name }).returning({ id: clients.id })
  return created.id
}

async function applyCaseUpsert(tx: Exec, ctx: ApplyContext): Promise<ApplyResult> {
  const target = await findTarget(tx, ctx.userId, 'case_upsert', ctx.externalRef, ctx.payload, ctx.caseRow)
  if (target.archived) throw new ApplyError('Hedef dava arşivlenmiş.')
  const proposed = proposedComparable('case_upsert', ctx.payload)
  if (!target.row) {
    if (!ctx.payload.title) throw new ApplyError('Yeni dava için title gerekli.')
    const clientId = await findOrCreateClient(tx, ctx.userId, ctx.payload)
    const values: Record<string, unknown> = { caseType: 'diger', ...toColumns(Object.fromEntries(Object.entries(proposed).filter(([, v]) => v !== undefined && v !== ''))) }
    const [row] = await tx
      .insert(cases)
      .values({
        ...(values as object),
        title: ctx.payload.title,
        status: ctx.payload.status ?? 'active',
        userId: ctx.userId,
        clientId,
        externalRef: ctx.externalRef,
        updatedByActor: ACTOR,
      } as typeof cases.$inferInsert)
      .returning({ id: cases.id })
    return { targetType: 'case', targetId: row.id, created: true, changedFields: Object.keys(values), overwrittenFields: [], conflictAtApply: false }
  }
  const plan = planFieldUpdates(stripMeta(target.snapshot), proposed, planOptionsFor('case_upsert', ctx.payload))
  const set: Record<string, unknown> = toColumns(plan.changes)
  if (!target.row.externalRef) {
    const [taken] = await tx.select({ id: cases.id }).from(cases).where(and(eq(cases.userId, ctx.userId), eq(cases.externalRef, ctx.externalRef))).limit(1)
    if (!taken) set.externalRef = ctx.externalRef
  }
  if (Object.keys(set).length) {
    await tx.update(cases).set({ ...set, updatedAt: new Date(), updatedByActor: ACTOR }).where(and(eq(cases.id, target.targetId!), eq(cases.userId, ctx.userId)))
  }
  return { targetType: 'case', targetId: target.targetId!, created: false, changedFields: Object.keys(plan.changes), overwrittenFields: plan.overwritten, conflictAtApply: detectConflict(target.actor, plan) }
}

async function applyStatusChange(tx: Exec, ctx: ApplyContext): Promise<ApplyResult> {
  const caseRow = ctx.caseRow!
  const target = await findTarget(tx, ctx.userId, 'status_change', ctx.externalRef, ctx.payload, caseRow)
  const plan = planFieldUpdates(stripMeta(target.snapshot), proposedComparable('status_change', ctx.payload))
  if (Object.keys(plan.changes).length) {
    await tx.update(cases).set({ ...toColumns(plan.changes), updatedAt: new Date(), updatedByActor: ACTOR }).where(and(eq(cases.id, caseRow.id), eq(cases.userId, ctx.userId)))
    if (plan.changes.status) {
      const from = CASE_STATUS_LABELS[caseRow.status] || caseRow.status
      const to = CASE_STATUS_LABELS[String(plan.changes.status)] || String(plan.changes.status)
      await diary(tx, ctx, caseRow.id, { entryType: 'status_changed', title: 'Dava durumu değişti (asistan önerisi)', content: [`${from} → ${to}`, ctx.payload.note].filter(Boolean).join('\n'), linkedEntityType: 'case', linkedEntityId: caseRow.id })
    }
  }
  return { targetType: 'case', targetId: caseRow.id, created: false, changedFields: Object.keys(plan.changes), overwrittenFields: plan.overwritten, conflictAtApply: detectConflict(target.actor, plan) }
}

async function applyHearingUpsert(tx: Exec, ctx: ApplyContext): Promise<ApplyResult> {
  const caseRow = ctx.caseRow!
  const target = await findTarget(tx, ctx.userId, 'hearing_upsert', ctx.externalRef, ctx.payload, caseRow)
  if (target.archived) throw new ApplyError('Bu duruşma avukat tarafından arşivlenmiş.')
  const proposed = proposedComparable('hearing_upsert', ctx.payload)
  const when = new Date(String(proposed.hearingDate)).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
  if (!target.row) {
    const [row] = await tx
      .insert(caseHearings)
      .values({
        caseId: caseRow.id,
        hearingDate: new Date(String(proposed.hearingDate)),
        courtRoom: ctx.payload.court_room || null,
        judge: ctx.payload.judge || null,
        notes: ctx.payload.notes || null,
        result: ctx.payload.result ?? 'pending',
        externalRef: ctx.externalRef,
        updatedByActor: ACTOR,
      })
      .returning({ id: caseHearings.id })
    await diary(tx, ctx, caseRow.id, { entryType: 'hearing_added', title: 'Duruşma eklendi (asistan önerisi)', content: `Tarih: ${when}${ctx.payload.court_room ? ` • Salon: ${ctx.payload.court_room}` : ''}`, linkedEntityType: 'hearing', linkedEntityId: row.id })
    return { targetType: 'hearing', targetId: row.id, created: true, changedFields: Object.keys(proposed).filter((k) => proposed[k] !== undefined), overwrittenFields: [], conflictAtApply: false, calendar: { hearingId: row.id } }
  }
  const plan = planFieldUpdates(stripMeta(target.snapshot), proposed)
  const link = refLink(target, ctx.externalRef)
  if (Object.keys(plan.changes).length || link.externalRef) {
    await tx.update(caseHearings).set({ ...toColumns(plan.changes), ...link, updatedAt: new Date(), updatedByActor: ACTOR }).where(eq(caseHearings.id, target.targetId!))
  }
  if (Object.keys(plan.changes).length) {
    await diary(tx, ctx, caseRow.id, { entryType: 'hearing_updated', title: 'Duruşma güncellendi (asistan önerisi)', content: `Değişen: ${Object.keys(plan.changes).join(', ')} • Tarih: ${when}`, linkedEntityType: 'hearing', linkedEntityId: target.targetId! })
  }
  return { targetType: 'hearing', targetId: target.targetId!, created: false, changedFields: [...Object.keys(plan.changes), ...Object.keys(link)], overwrittenFields: plan.overwritten, conflictAtApply: detectConflict(target.actor, plan), calendar: { hearingId: target.targetId! } }
}

async function applyTaskLike(tx: Exec, ctx: ApplyContext): Promise<ApplyResult> {
  const kind = ctx.kind as 'deadline_upsert' | 'task_add'
  const target = await findTarget(tx, ctx.userId, kind, ctx.externalRef, ctx.payload, ctx.caseRow)
  if (target.archived) throw new ApplyError('Bu görev avukat tarafından arşivlenmiş.')
  const proposed = proposedComparable(kind, ctx.payload)
  const statusChange = (status: unknown) =>
    status === 'completed' ? { completedAt: new Date() } : status ? { completedAt: null } : {}
  if (!target.row) {
    const [minSortRow] = await tx
      .select({ min: sql<number | null>`min(${tasks.sortOrder})` })
      .from(tasks)
      .where(and(eq(tasks.userId, ctx.userId), isNull(tasks.archivedAt)))
    const values = toColumns(Object.fromEntries(Object.entries(proposed).filter(([, v]) => v !== undefined && v !== '')))
    const [row] = await tx
      .insert(tasks)
      .values({
        ...(values as object),
        title: String(proposed.title),
        userId: ctx.userId,
        caseId: ctx.caseRow?.id ?? null,
        category: (values.category as string | undefined) ?? (ctx.caseRow ? (ctx.caseRow.isCmkAssignment ? 'cmk' : 'dava') : 'genel'),
        isDeadline: kind === 'deadline_upsert',
        sortOrder: Number(minSortRow?.min ?? 0) - 1,
        externalRef: ctx.externalRef,
        updatedByActor: ACTOR,
        ...statusChange(proposed.status),
      } as typeof tasks.$inferInsert)
      .returning({ id: tasks.id })
    if (ctx.caseRow) {
      await diary(tx, ctx, ctx.caseRow.id, { entryType: 'task_added', title: kind === 'deadline_upsert' ? 'Süreli iş eklendi (asistan önerisi)' : 'Görev eklendi (asistan önerisi)', content: String(proposed.title), linkedEntityType: 'task', linkedEntityId: row.id })
    }
    return { targetType: 'task', targetId: row.id, created: true, changedFields: Object.keys(values), overwrittenFields: [], conflictAtApply: false, calendar: { taskId: row.id } }
  }
  const plan = planFieldUpdates(stripMeta(target.snapshot), proposed)
  const link = refLink(target, ctx.externalRef)
  if (Object.keys(plan.changes).length || link.externalRef) {
    await tx
      .update(tasks)
      .set({ ...toColumns(plan.changes), ...statusChange(plan.changes.status), ...link, updatedAt: new Date(), updatedByActor: ACTOR })
      .where(and(eq(tasks.id, target.targetId!), eq(tasks.userId, ctx.userId)))
  }
  return { targetType: 'task', targetId: target.targetId!, created: false, changedFields: [...Object.keys(plan.changes), ...Object.keys(link)], overwrittenFields: plan.overwritten, conflictAtApply: detectConflict(target.actor, plan), calendar: { taskId: target.targetId! } }
}

async function applyDiaryAdd(tx: Exec, ctx: ApplyContext): Promise<ApplyResult> {
  const caseRow = ctx.caseRow!
  const target = await findTarget(tx, ctx.userId, ctx.kind, ctx.externalRef, ctx.payload, caseRow)
  // Aynı external_ref ile girdi zaten varsa tekrar eklenmez (idempotent).
  if (target.row) return { targetType: 'diary', targetId: target.targetId!, created: false, changedFields: [], overwrittenFields: [], conflictAtApply: false }
  const p = ctx.payload
  const isNextStep = ctx.kind === 'next_step'
  const [row] = await tx
    .insert(caseDiaryEntries)
    .values({
      caseId: caseRow.id,
      userId: ctx.userId,
      entryType: 'manual',
      title: isNextStep ? 'Sonraki adım (asistan önerisi)' : p.title || ctx.summary.slice(0, 255),
      content: isNextStep ? ctx.summary : p.content,
      nextStep: p.next_step || null,
      nextStepDueDate: p.next_step_due_date || null,
      occurredAt: p.occurred_at ? new Date(p.occurred_at) : new Date(),
      linkedEntityType: 'asistan',
      externalRef: ctx.externalRef,
      updatedByActor: ACTOR,
    })
    .returning({ id: caseDiaryEntries.id })
  return { targetType: 'diary', targetId: row.id, created: true, changedFields: ['content'], overwrittenFields: [], conflictAtApply: false }
}

async function applyNextStep(tx: Exec, ctx: ApplyContext): Promise<ApplyResult> {
  if (ctx.payload.target === 'diary') return applyDiaryAdd(tx, ctx)
  const caseRow = ctx.caseRow!
  const target = await findTarget(tx, ctx.userId, 'next_step', ctx.externalRef, ctx.payload, caseRow)
  const plan = planFieldUpdates(stripMeta(target.snapshot), proposedComparable('next_step', ctx.payload))
  if (Object.keys(plan.changes).length) {
    const [current] = await tx.select().from(caseWorkspaces).where(eq(caseWorkspaces.caseId, caseRow.id)).for('update')
    if (current) {
      await tx.update(caseWorkspaces).set({ ...plan.changes, revision: current.revision + 1, updatedAt: new Date() }).where(eq(caseWorkspaces.caseId, caseRow.id))
    } else {
      await tx.insert(caseWorkspaces).values({ caseId: caseRow.id, stage: '', waitingFor: '', ...plan.changes, revision: 1 })
    }
    const merged: Record<string, unknown> = Object.assign({ stage: '', waitingFor: '', checkDate: null }, current ?? {}, plan.changes)
    await diary(tx, ctx, caseRow.id, { entryType: 'manual', title: 'Çalışma planı güncellendi (asistan önerisi)', content: `Aşama: ${merged.stage || 'Belirtilmedi'}\nBeklenen: ${merged.waitingFor || 'Yok'}\nKontrol: ${merged.checkDate || 'Belirtilmedi'}` })
  }
  return { targetType: 'workspace', targetId: caseRow.id, created: !target.row, changedFields: Object.keys(plan.changes), overwrittenFields: plan.overwritten, conflictAtApply: detectConflict(target.actor, plan) }
}

async function applyEnforcement(tx: Exec, ctx: ApplyContext): Promise<ApplyResult> {
  const caseRow = ctx.caseRow!
  const [current] = await tx.select().from(caseEnforcement).where(eq(caseEnforcement.caseId, caseRow.id)).for('update')
  const incoming = ctx.payload.data as Record<string, unknown>
  const plan = planFieldUpdates((current?.data as Record<string, unknown>) ?? null, incoming)
  const data = mergeJsonData(current?.data as Record<string, unknown> | undefined, plan.changes)
  if (!current) {
    await tx.insert(caseEnforcement).values({ caseId: caseRow.id, data, sourceRef: ctx.payload.source_ref ?? null, updatedByActor: ACTOR })
  } else if (Object.keys(plan.changes).length || (ctx.payload.source_ref && ctx.payload.source_ref !== current.sourceRef)) {
    await tx.update(caseEnforcement).set({ data, sourceRef: ctx.payload.source_ref ?? current.sourceRef, updatedAt: new Date(), updatedByActor: ACTOR }).where(eq(caseEnforcement.caseId, caseRow.id))
  }
  return { targetType: 'enforcement', targetId: caseRow.id, created: !current, changedFields: Object.keys(plan.changes), overwrittenFields: plan.overwritten, conflictAtApply: !!current && detectConflict(current.updatedByActor, plan) }
}

export async function applyProposal(tx: Exec, ctx: ApplyContext): Promise<ApplyResult> {
  switch (ctx.kind) {
    case 'case_upsert': return applyCaseUpsert(tx, ctx)
    case 'status_change': return applyStatusChange(tx, ctx)
    case 'hearing_upsert': return applyHearingUpsert(tx, ctx)
    case 'deadline_upsert':
    case 'task_add': return applyTaskLike(tx, ctx)
    case 'diary_add': return applyDiaryAdd(tx, ctx)
    case 'next_step': return applyNextStep(tx, ctx)
    case 'enforcement_upsert': return applyEnforcement(tx, ctx)
  }
}
