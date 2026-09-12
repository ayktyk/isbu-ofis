type DateValue = string | Date | null
export interface TrackingTask {
  id: string; caseId: string | null; title: string; status: string
  dueDate: DateValue; isDeadline: boolean; archivedAt?: DateValue
}
export interface TrackingDiary {
  id: string; caseId: string; entryType: string; content: string | null; title: string | null
  nextStep: string | null; nextStepDone: boolean; nextStepDueDate: DateValue
  occurredAt: DateValue; archivedAt?: DateValue
}
export interface TrackingHearing {
  id: string; caseId: string; hearingDate: DateValue; result: string; archivedAt?: DateValue
}
export interface TrackingNote {
  id: string; caseId: string | null; content: string; createdAt: DateValue; archivedAt?: DateValue
}
export interface CaseTrackingSummary {
  nextWork: { id: string; kind: 'task' | 'deadline' | 'diary'; title: string; dueDate: string | null } | null
  openCount: number
  deadlineCount: number
  overdueCount: number
  nextHearing: { id: string; date: string } | null
  lastDevelopment: { text: string; date: string } | null
}

function serializedDate(value: DateValue): string | null {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}
function trDay(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find(p => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

// Pure aggregation only: callers must enforce ownership before supplying rows.
export function summarizeCaseTracking(caseIds: string[], rows: {
  tasks: TrackingTask[]; diary: TrackingDiary[]; hearings: TrackingHearing[]; notes: TrackingNote[]
}, now = new Date()): Record<string, CaseTrackingSummary> {
  const result: Record<string, CaseTrackingSummary> = Object.create(null)
  const today = trDay(now)
  for (const id of caseIds) result[id] = { nextWork: null, openCount: 0, deadlineCount: 0, overdueCount: 0, nextHearing: null, lastDevelopment: null }
  function addWork(caseId: string | null, work: NonNullable<CaseTrackingSummary['nextWork']>) {
    if (!caseId || !result[caseId]) return
    const summary = result[caseId]
    summary.openCount++
    if (work.kind === 'deadline') summary.deadlineCount++
    if (work.dueDate) {
      const day = work.dueDate.length === 10 ? work.dueDate : trDay(new Date(work.dueDate))
      if (day < today) summary.overdueCount++
    }
    const rank = (item: typeof work) => item.dueDate ? Date.parse(item.dueDate.length === 10 ? `${item.dueDate}T00:00:00+03:00` : item.dueDate) : Number.MAX_SAFE_INTEGER
    const previous = summary.nextWork
    if (!previous || rank(work) < rank(previous) || (rank(work) === rank(previous) && work.kind === 'deadline' && previous.kind !== 'deadline')) summary.nextWork = work
  }
  function addDevelopment(caseId: string | null, text: string | null, value: DateValue) {
    const date = serializedDate(value)
    if (!caseId || !result[caseId] || !text?.trim() || !date) return
    const previous = result[caseId].lastDevelopment
    if (!previous || Date.parse(date) > Date.parse(previous.date)) result[caseId].lastDevelopment = { text: text.trim().slice(0, 240), date }
  }
  for (const task of rows.tasks) {
    if (!task.archivedAt && ['pending', 'in_progress'].includes(task.status)) addWork(task.caseId, { id: task.id, kind: task.isDeadline ? 'deadline' : 'task', title: task.title, dueDate: serializedDate(task.dueDate) })
  }
  for (const entry of rows.diary) {
    if (entry.archivedAt) continue
    if (entry.nextStep?.trim() && !entry.nextStepDone) addWork(entry.caseId, { id: entry.id, kind: 'diary', title: entry.nextStep.trim(), dueDate: serializedDate(entry.nextStepDueDate) })
    if (['manual', 'hearing_completed', 'status_changed'].includes(entry.entryType)) addDevelopment(entry.caseId, entry.content || entry.title, entry.occurredAt)
  }
  for (const note of rows.notes) if (!note.archivedAt) addDevelopment(note.caseId, note.content, note.createdAt)
  for (const hearing of rows.hearings) {
    const summary = result[hearing.caseId]
    const date = serializedDate(hearing.hearingDate)
    if (!summary || hearing.archivedAt || hearing.result !== 'pending' || !date || Date.parse(date) < now.getTime()) continue
    if (!summary.nextHearing || Date.parse(date) < Date.parse(summary.nextHearing.date)) summary.nextHearing = { id: hearing.id, date }
  }
  return result
}
