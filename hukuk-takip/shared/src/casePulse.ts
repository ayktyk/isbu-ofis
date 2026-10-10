// Dosya nabzı — her aktif dava ve arabuluculuk dosyası için "sırada ne var?"
// sorusunun cevabı. Saf fonksiyon: sahiplik kontrolü çağıranın sorumluluğundadır.

type DateValue = string | Date | null | undefined

export interface PulseCaseInput {
  id: string
  title: string
  status: string
  isCmkAssignment?: boolean
  caseNumber?: string | null
  courtName?: string | null
  buroKodu?: string | null
  clientName?: string | null
  contractedFee?: string | number | null
  createdAt?: DateValue
  updatedAt?: DateValue
}
export interface PulseMediationInput {
  id: string
  title: string
  status: string
  agreedFee?: string | number | null
  createdAt?: DateValue
  updatedAt?: DateValue
}
export interface PulseHearingInput { id: string; caseId: string; hearingDate: DateValue; result: string }
export interface PulseTaskInput {
  id: string; caseId: string | null; title: string; status: string; dueDate: DateValue
  isDeadline: boolean; createdAt?: DateValue; updatedAt?: DateValue; completedAt?: DateValue
}
export interface PulseDiaryInput {
  id: string; caseId: string; occurredAt: DateValue; nextStep: string | null
  nextStepDone: boolean; nextStepDueDate: DateValue
}
export interface PulseWorkspaceInput { caseId: string; waitingFor: string; checkDate: DateValue; stage?: string }
export interface PulseCollectionInput { caseId: string | null; mediationFileId: string | null; amount: string | number; collectionDate?: DateValue }
export interface PulseInstallmentInput { caseId: string; amount: string | number; dueDate: DateValue; status: string }

export interface CasePulseInput {
  cases: PulseCaseInput[]
  mediationFiles?: PulseMediationInput[]
  hearings?: PulseHearingInput[]
  tasks?: PulseTaskInput[]
  diary?: PulseDiaryInput[]
  workspaces?: PulseWorkspaceInput[]
  collections?: PulseCollectionInput[]
  installments?: PulseInstallmentInput[]
}

export type PulseFlag =
  | 'atil'
  | 'sirada_is_yok'
  | 'tahsilat_bekliyor'
  | 'kapanmaya_hazir'
  | 'sure_yaklasiyor'
  | 'gecikmis'
  | 'cmk'

export type PulseNextKind = 'hearing' | 'deadline' | 'task' | 'check' | 'next_step'

export interface PulseNextItem {
  kind: PulseNextKind
  id: string
  title: string
  // Gün (YYYY-AA-GG) ya da tarih-saat (ISO); tarihsiz açık işte null
  date: string | null
  overdue: boolean
}

export interface CasePulseItem {
  type: 'case' | 'mediation'
  id: string
  title: string
  status: string
  caseNumber: string | null
  courtName: string | null
  buroKodu: string | null
  clientName: string | null
  lastActivityAt: string | null
  daysSinceActivity: number | null
  nextItem: PulseNextItem | null
  openItemCount: number
  openBalance: number | null
  overdueInstallments: { count: number; amount: number }
  flags: PulseFlag[]
  urgency: number
}

export const PULSE_IDLE_DAYS = 30
export const PULSE_DEADLINE_WARN_DAYS = 7
const FINISHED_WITH_RESULT = ['won', 'lost', 'settled']

function trDay(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = (type: string) => parts.find((p) => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function toDate(value: DateValue): Date | null {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00+03:00`)
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function serialize(value: DateValue): string | null {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = toDate(value)
  return date ? date.toISOString() : null
}

function dayOf(value: DateValue): string | null {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = toDate(value)
  return date ? trDay(date) : null
}

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function money(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(value ?? '')
  return Number.isFinite(n) ? n : 0
}

function sortKey(item: PulseNextItem): number {
  if (!item.date) return Number.MAX_SAFE_INTEGER
  return toDate(item.date)?.getTime() ?? Number.MAX_SAFE_INTEGER
}

const KIND_RANK: Record<PulseNextKind, number> = { deadline: 0, hearing: 1, task: 2, next_step: 3, check: 4 }

function pickEarlier(a: PulseNextItem | null, b: PulseNextItem): PulseNextItem {
  if (!a) return b
  const ka = sortKey(a)
  const kb = sortKey(b)
  if (kb < ka) return b
  if (kb === ka && KIND_RANK[b.kind] < KIND_RANK[a.kind]) return b
  return a
}

// Aciliyet: küçük sayı = daha acil.
//   0 gecikmiş iş / gecikmiş taksit, 1 süre yaklaşıyor, 2 atıl, 3 sırada iş yok,
//   4 planlı, 5 yalnız tahsilat / kapanmaya hazır.
function urgencyOf(flags: Set<PulseFlag>, hasNext: boolean): number {
  if (flags.has('gecikmis')) return 0
  if (flags.has('sure_yaklasiyor')) return 1
  if (flags.has('atil')) return 2
  if (flags.has('sirada_is_yok') && !flags.has('kapanmaya_hazir')) return 3
  if (hasNext) return 4
  return 5
}

export function computeCasePulse(input: CasePulseInput, now = new Date()): CasePulseItem[] {
  const today = trDay(now)
  const warnUntil = addDays(today, PULSE_DEADLINE_WARN_DAYS)
  const items: CasePulseItem[] = []

  const byCase = <T extends { caseId: string | null }>(rows: T[] | undefined) => {
    const map = new Map<string, T[]>()
    for (const row of rows ?? []) {
      if (!row.caseId) continue
      const list = map.get(row.caseId) ?? []
      list.push(row)
      map.set(row.caseId, list)
    }
    return map
  }
  const hearingsBy = byCase(input.hearings)
  const tasksBy = byCase(input.tasks)
  const diaryBy = byCase(input.diary)
  const workspaceBy = new Map((input.workspaces ?? []).map((w) => [w.caseId, w]))
  const collectedBy = new Map<string, number>()
  const mediationCollected = new Map<string, number>()
  for (const c of input.collections ?? []) {
    if (c.caseId) collectedBy.set(c.caseId, (collectedBy.get(c.caseId) ?? 0) + money(c.amount))
    else if (c.mediationFileId) mediationCollected.set(c.mediationFileId, (mediationCollected.get(c.mediationFileId) ?? 0) + money(c.amount))
  }
  const installmentsBy = byCase(input.installments)

  for (const c of input.cases) {
    if (c.status === 'closed') continue
    let next: PulseNextItem | null = null
    let openCount = 0
    let deadlineSoon = false
    let overdue = false
    const activity: number[] = []
    const mark = (value: DateValue) => {
      const d = toDate(value)
      if (d && d.getTime() <= now.getTime()) activity.push(d.getTime())
    }
    mark(c.updatedAt)
    mark(c.createdAt)

    for (const h of hearingsBy.get(c.id) ?? []) {
      const date = toDate(h.hearingDate)
      if (!date) continue
      if (date.getTime() <= now.getTime()) mark(date)
      const day = trDay(date)
      if (h.result === 'pending' && day >= today) {
        openCount++
        next = pickEarlier(next, { kind: 'hearing', id: h.id, title: 'Duruşma', date: serialize(h.hearingDate), overdue: false })
      }
    }
    for (const t of tasksBy.get(c.id) ?? []) {
      mark(t.updatedAt ?? t.createdAt)
      mark(t.completedAt)
      if (!['pending', 'in_progress'].includes(t.status)) continue
      openCount++
      const day = dayOf(t.dueDate)
      const isOverdue = !!day && day < today
      if (isOverdue) overdue = true
      if (t.isDeadline && day && day <= warnUntil) deadlineSoon = true
      next = pickEarlier(next, { kind: t.isDeadline ? 'deadline' : 'task', id: t.id, title: t.title, date: serialize(t.dueDate), overdue: isOverdue })
    }
    for (const d of diaryBy.get(c.id) ?? []) {
      mark(d.occurredAt)
      if (!d.nextStep?.trim() || d.nextStepDone) continue
      openCount++
      const day = dayOf(d.nextStepDueDate)
      const isOverdue = !!day && day < today
      if (isOverdue) overdue = true
      next = pickEarlier(next, { kind: 'next_step', id: d.id, title: d.nextStep.trim(), date: serialize(d.nextStepDueDate), overdue: isOverdue })
    }
    const ws = workspaceBy.get(c.id)
    const checkDay = ws ? dayOf(ws.checkDate) : null
    if (ws && checkDay) {
      openCount++
      const isOverdue = checkDay < today
      if (isOverdue) overdue = true
      next = pickEarlier(next, { kind: 'check', id: c.id, title: ws.waitingFor?.trim() ? `Kontrol: ${ws.waitingFor.trim()}` : 'Kontrol tarihi', date: checkDay, overdue: isOverdue })
    }

    const fee = c.contractedFee == null || c.contractedFee === '' ? null : money(c.contractedFee)
    const openBalance = fee && fee > 0 ? Math.round((fee - (collectedBy.get(c.id) ?? 0)) * 100) / 100 : null
    const overdueInst = { count: 0, amount: 0 }
    for (const inst of installmentsBy.get(c.id) ?? []) {
      const day = dayOf(inst.dueDate)
      if (inst.status !== 'paid' && day && day < today) {
        overdueInst.count++
        overdueInst.amount = Math.round((overdueInst.amount + money(inst.amount)) * 100) / 100
      }
    }

    const lastActivity = activity.length ? Math.max(...activity) : null
    const daysSince = lastActivity === null ? null : Math.floor((now.getTime() - lastActivity) / 86_400_000)
    const flags = new Set<PulseFlag>()
    if (!next) flags.add('sirada_is_yok')
    if (!next && (daysSince === null || daysSince > PULSE_IDLE_DAYS)) flags.add('atil')
    if (openBalance !== null && openBalance > 0) flags.add('tahsilat_bekliyor')
    if (deadlineSoon) flags.add('sure_yaklasiyor')
    if (overdue || overdueInst.count > 0) flags.add('gecikmis')
    if (FINISHED_WITH_RESULT.includes(c.status) && openCount === 0 && !(openBalance && openBalance > 0)) flags.add('kapanmaya_hazir')
    if (c.isCmkAssignment) flags.add('cmk')
    // Kararı çıkmış dosyada "atıl" uyarısı yerine kapanmaya hazır gösterilir.
    if (flags.has('kapanmaya_hazir')) flags.delete('atil')

    items.push({
      type: 'case', id: c.id, title: c.title, status: c.status,
      caseNumber: c.caseNumber ?? null, courtName: c.courtName ?? null, buroKodu: c.buroKodu ?? null,
      clientName: c.clientName ?? null,
      lastActivityAt: lastActivity === null ? null : new Date(lastActivity).toISOString(),
      daysSinceActivity: daysSince, nextItem: next, openItemCount: openCount,
      openBalance, overdueInstallments: overdueInst,
      flags: [...flags], urgency: urgencyOf(flags, !!next),
    })
  }

  for (const m of input.mediationFiles ?? []) {
    if (m.status !== 'active') continue
    const activity = [toDate(m.updatedAt), toDate(m.createdAt)].filter((d): d is Date => !!d && d.getTime() <= now.getTime()).map((d) => d.getTime())
    const lastActivity = activity.length ? Math.max(...activity) : null
    const daysSince = lastActivity === null ? null : Math.floor((now.getTime() - lastActivity) / 86_400_000)
    const fee = m.agreedFee == null || m.agreedFee === '' ? null : money(m.agreedFee)
    const openBalance = fee && fee > 0 ? Math.round((fee - (mediationCollected.get(m.id) ?? 0)) * 100) / 100 : null
    const flags = new Set<PulseFlag>(['sirada_is_yok'])
    if (daysSince === null || daysSince > PULSE_IDLE_DAYS) flags.add('atil')
    if (openBalance !== null && openBalance > 0) flags.add('tahsilat_bekliyor')
    items.push({
      type: 'mediation', id: m.id, title: m.title, status: m.status,
      caseNumber: null, courtName: null, buroKodu: null, clientName: null,
      lastActivityAt: lastActivity === null ? null : new Date(lastActivity).toISOString(),
      daysSinceActivity: daysSince, nextItem: null, openItemCount: 0,
      openBalance, overdueInstallments: { count: 0, amount: 0 },
      flags: [...flags], urgency: urgencyOf(flags, false),
    })
  }

  return items.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency - b.urgency
    const ka = a.nextItem ? sortKey(a.nextItem) : Number.MAX_SAFE_INTEGER
    const kb = b.nextItem ? sortKey(b.nextItem) : Number.MAX_SAFE_INTEGER
    if (ka !== kb) return ka - kb
    // Eşitlikte en uzun süredir dokunulmayan önce
    return (b.daysSinceActivity ?? Number.MAX_SAFE_INTEGER) - (a.daysSinceActivity ?? Number.MAX_SAFE_INTEGER)
  })
}
