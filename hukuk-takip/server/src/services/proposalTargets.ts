// Öneri hedeflerini bulma ve karşılaştırılabilir anlık görüntü (snapshot) üretme.
// Tüm sorgular userId ile sahiplik filtresi uygular.
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import type { CaseRef, FieldPlanOptions, ProposalKind } from '@hukuk-takip/shared'
import {
  caseDiaryEntries,
  caseEnforcement,
  caseHearings,
  cases,
  caseWorkspaces,
  tasks,
  type Case,
} from '../db/schema.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Exec = PgDatabase<any, any, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPayload = Record<string, any>

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
  }
}

// Onay sırasında iş kuralı nedeniyle uygulanamayan öneri (status=failed yazılır).
export class ApplyError extends Error {}

export const TIMESTAMP_KEYS = new Set(['hearingDate', 'dueDate', 'occurredAt'])

export function iso(value: unknown): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

export function trDay(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
}

// Gün olarak verilen son tarihler İstanbul saatiyle 09:00'a yerleştirilir
// (takvim senkronu ve gecikme hesabı aynı günü görsün).
export function dueDateFrom(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T09:00:00+03:00`)
  return new Date(value)
}

export const KINDS_NEEDING_CASE: ReadonlySet<ProposalKind> = new Set([
  'hearing_upsert',
  'diary_add',
  'enforcement_upsert',
  'next_step',
  'status_change',
])

export async function resolveCaseRef(exec: Exec, userId: string, ref: CaseRef): Promise<Case | null> {
  const owned = and(eq(cases.userId, userId), isNull(cases.archivedAt))
  let rows: Case[] = []
  if (ref.id) {
    rows = await exec.select().from(cases).where(and(owned, eq(cases.id, ref.id))).limit(2)
  } else if (ref.external_ref) {
    rows = await exec.select().from(cases).where(and(owned, eq(cases.externalRef, ref.external_ref))).limit(2)
  } else if (ref.buro_kodu) {
    rows = await exec.select().from(cases).where(and(owned, eq(cases.buroKodu, ref.buro_kodu))).limit(2)
  } else if (ref.case_number && ref.court_name) {
    rows = await exec
      .select()
      .from(cases)
      .where(
        and(
          owned,
          sql`lower(trim(${cases.caseNumber})) = lower(trim(${ref.case_number}))`,
          sql`lower(trim(${cases.courtName})) = lower(trim(${ref.court_name}))`
        )
      )
      .limit(2)
  }
  if (rows.length > 1) throw new HttpError(409, 'Dava referansı birden fazla davayla eşleşti; id veya external_ref kullanın.')
  return rows[0] ?? null
}

export interface ResolvedTarget {
  targetType: string
  row: AnyPayload | null
  targetId: string | null
  snapshot: Record<string, unknown> | null
  actor: string | null
  archived: boolean
}

const EMPTY = (targetType: string): ResolvedTarget => ({ targetType, row: null, targetId: null, snapshot: null, actor: null, archived: false })

export function caseSnapshot(row: AnyPayload) {
  return {
    title: row.title,
    caseNumber: row.caseNumber,
    courtName: row.courtName,
    caseType: row.caseType,
    customCaseType: row.customCaseType,
    description: row.description,
    startDate: row.startDate,
    buroKodu: row.buroKodu,
    contractedFee: row.contractedFee,
    isCmkAssignment: row.isCmkAssignment,
    status: row.status,
    closeDate: row.closeDate,
    externalRef: row.externalRef,
  }
}

function taskSnapshot(row: AnyPayload) {
  return {
    title: row.title,
    description: row.description,
    dueDate: iso(row.dueDate),
    calculatedDueDate: row.calculatedDueDate,
    priority: row.priority,
    status: row.status,
    category: row.category,
    isDeadline: row.isDeadline,
    legalBasis: row.legalBasis,
    deadlineCategory: row.deadlineCategory,
    deadlineSeverity: row.deadlineSeverity,
    triggerEventDate: row.triggerEventDate,
    triggerEventLabel: row.triggerEventLabel,
    caseId: row.caseId,
  }
}

function withMeta(targetType: string, row: AnyPayload | undefined, snapshot: (r: AnyPayload) => Record<string, unknown>, id?: string): ResolvedTarget {
  if (!row) return EMPTY(targetType)
  return {
    targetType,
    row,
    targetId: id ?? row.id,
    snapshot: { ...snapshot(row), updatedByActor: row.updatedByActor ?? null, updatedAt: iso(row.updatedAt) },
    actor: row.updatedByActor ?? 'avukat',
    archived: !!row.archivedAt,
  }
}

// Önerinin değiştireceği kaydı bulur (arşivlenmiş olanlar dahil — arşiv avukat
// kararıdır, öneri onu geri getirmez).
export async function findTarget(
  exec: Exec,
  userId: string,
  kind: ProposalKind,
  externalRef: string,
  payload: AnyPayload,
  caseRow: Case | null
): Promise<ResolvedTarget> {
  switch (kind) {
    case 'case_upsert': {
      const [byRef] = await exec.select().from(cases).where(and(eq(cases.userId, userId), eq(cases.externalRef, externalRef))).limit(1)
      return withMeta('case', byRef ?? caseRow ?? undefined, caseSnapshot)
    }
    case 'status_change':
      return withMeta('case', caseRow ?? undefined, (r) => ({ status: r.status, closeDate: r.closeDate }))
    case 'hearing_upsert': {
      if (!caseRow) return EMPTY('hearing')
      const [row] = await exec.select().from(caseHearings).where(and(eq(caseHearings.caseId, caseRow.id), eq(caseHearings.externalRef, externalRef))).limit(1)
      return withMeta('hearing', row, (r) => ({ hearingDate: iso(r.hearingDate), courtRoom: r.courtRoom, judge: r.judge, notes: r.notes, result: r.result }))
    }
    case 'deadline_upsert':
    case 'task_add': {
      const [row] = await exec.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.externalRef, externalRef))).limit(1)
      return withMeta('task', row, taskSnapshot)
    }
    case 'diary_add': {
      if (!caseRow) return EMPTY('diary')
      const [row] = await exec.select().from(caseDiaryEntries).where(and(eq(caseDiaryEntries.caseId, caseRow.id), eq(caseDiaryEntries.externalRef, externalRef))).limit(1)
      return withMeta('diary', row, (r) => ({ title: r.title, content: r.content, occurredAt: iso(r.occurredAt), nextStep: r.nextStep, nextStepDueDate: r.nextStepDueDate }))
    }
    case 'next_step': {
      if (!caseRow) return EMPTY(payload.target === 'diary' ? 'diary' : 'workspace')
      if (payload.target === 'diary') {
        const [row] = await exec.select().from(caseDiaryEntries).where(and(eq(caseDiaryEntries.caseId, caseRow.id), eq(caseDiaryEntries.externalRef, externalRef))).limit(1)
        return withMeta('diary', row, (r) => ({ nextStep: r.nextStep, nextStepDueDate: r.nextStepDueDate }))
      }
      const [row] = await exec.select().from(caseWorkspaces).where(eq(caseWorkspaces.caseId, caseRow.id)).limit(1)
      if (!row) return EMPTY('workspace')
      // Çalışma planında aktör kolonu yok: dolu alanlar avukatın kabul edilir.
      return {
        targetType: 'workspace',
        row,
        targetId: caseRow.id,
        snapshot: { stage: row.stage, waitingFor: row.waitingFor, checkDate: row.checkDate, revision: row.revision, updatedAt: iso(row.updatedAt) },
        actor: 'avukat',
        archived: false,
      }
    }
    case 'enforcement_upsert': {
      if (!caseRow) return EMPTY('enforcement')
      const [row] = await exec.select().from(caseEnforcement).where(eq(caseEnforcement.caseId, caseRow.id)).limit(1)
      if (!row) return EMPTY('enforcement')
      return {
        targetType: 'enforcement',
        row,
        targetId: caseRow.id,
        snapshot: { ...(row.data as Record<string, unknown>), __sourceRef: row.sourceRef, updatedByActor: row.updatedByActor, updatedAt: iso(row.updatedAt) },
        actor: row.updatedByActor,
        archived: false,
      }
    }
  }
}

const CASE_FIELD_MAP: Record<string, string> = {
  title: 'title',
  case_number: 'caseNumber',
  court_name: 'courtName',
  case_type: 'caseType',
  custom_case_type: 'customCaseType',
  description: 'description',
  start_date: 'startDate',
  buro_kodu: 'buroKodu',
  contracted_fee: 'contractedFee',
  is_cmk_assignment: 'isCmkAssignment',
}

function deadlineTitle(payload: AnyPayload) {
  const title = String(payload.title)
  return payload.conditional && !payload.due_date && !title.startsWith('[Koşullu]') ? `[Koşullu] ${title}`.slice(0, 500) : title
}

function deadlineDescription(payload: AnyPayload) {
  const parts = [payload.description, payload.condition ? `Koşul: ${payload.condition}` : null].filter(Boolean)
  return parts.length ? parts.join('\n') : undefined
}

// Öneriyi hedef tablonun kolon uzayına çevirir (karşılaştırma + uygulama için).
export function proposedComparable(kind: ProposalKind, payload: AnyPayload): Record<string, unknown> {
  switch (kind) {
    case 'case_upsert': {
      const out: Record<string, unknown> = {}
      for (const [snake, camel] of Object.entries(CASE_FIELD_MAP)) out[camel] = payload[snake]
      return out
    }
    case 'status_change':
      return { status: payload.status, closeDate: payload.close_date }
    case 'hearing_upsert':
      return { hearingDate: iso(payload.hearing_date), courtRoom: payload.court_room, judge: payload.judge, notes: payload.notes, result: payload.result }
    case 'deadline_upsert': {
      const due = payload.conditional && !payload.due_date ? undefined : dueDateFrom(payload.due_date)
      return {
        title: deadlineTitle(payload),
        description: deadlineDescription(payload),
        dueDate: due === undefined ? undefined : iso(due),
        calculatedDueDate: due ? trDay(due) : undefined,
        priority: payload.priority,
        status: payload.status,
        isDeadline: true,
        legalBasis: payload.legal_basis,
        deadlineCategory: payload.deadline_category,
        deadlineSeverity: payload.deadline_severity,
        triggerEventDate: payload.trigger_event_date,
        triggerEventLabel: payload.trigger_event_label,
      }
    }
    case 'task_add': {
      const due = dueDateFrom(payload.due_date)
      return { title: payload.title, description: payload.description, dueDate: due === undefined ? undefined : iso(due), priority: payload.priority, category: payload.category }
    }
    case 'diary_add':
      return { title: payload.title, content: payload.content, occurredAt: iso(payload.occurred_at) ?? undefined, nextStep: payload.next_step, nextStepDueDate: payload.next_step_due_date }
    case 'next_step':
      return payload.target === 'diary'
        ? { nextStep: payload.next_step, nextStepDueDate: payload.next_step_due_date }
        : { stage: payload.stage, waitingFor: payload.waiting_for, checkDate: payload.check_date }
    case 'enforcement_upsert':
      return { ...payload.data }
  }
}

export function planOptionsFor(kind: ProposalKind, payload: AnyPayload): FieldPlanOptions {
  if (kind === 'case_upsert') {
    return { fillOnly: true, overwrite: (payload.overwrite ?? []).map((f: string) => CASE_FIELD_MAP[f]).filter(Boolean) }
  }
  return {}
}

// Var olan hedef değişmeyecekse (ör. aynı günlük girdisi zaten var) öneri gereksizdir.
export function isInsertOnly(kind: ProposalKind, payload: AnyPayload) {
  return kind === 'diary_add' || (kind === 'next_step' && payload.target === 'diary')
}

export function stripMeta(snapshot: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!snapshot) return null
  const { updatedByActor: _a, updatedAt: _u, revision: _r, __sourceRef: _s, ...rest } = snapshot
  return rest
}
