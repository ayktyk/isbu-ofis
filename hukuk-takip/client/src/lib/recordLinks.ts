export type CaseRecordKind = 'task' | 'deadline' | 'hearing' | 'note' | 'document' | 'expense' | 'collection' | 'entry'
const sections: Record<CaseRecordKind, string> = { task: 'work', deadline: 'work', hearing: 'work', note: 'overview', document: 'documents', expense: 'finance', collection: 'finance', entry: 'overview' }
export function caseRecordHref(caseId: string, kind: CaseRecordKind, id: string) {
  return `/cases/${encodeURIComponent(caseId)}?${new URLSearchParams({ section: sections[kind], focus: `case-${kind}-${id}` })}`
}
export function taskHref(task: { id: string; caseId?: string | null; isDeadline?: boolean }) {
  return task.caseId ? caseRecordHref(task.caseId, task.isDeadline ? 'deadline' : 'task', task.id) : `${task.isDeadline ? '/sureli-isler' : '/tasks'}?task=${encodeURIComponent(task.id)}`
}
export function notificationHref(notification: { relatedId?: string | null; relatedType?: string | null; type?: string }) {
  const id = notification.relatedId
  if (!id) return null
  const kind = notification.relatedType || notification.type || ''
  if (kind.startsWith('legal_deadline') || notification.type === 'legal_deadline_critical') return `/sureli-isler?task=${encodeURIComponent(id)}`
  if (kind.startsWith('task')) return `/tasks?task=${encodeURIComponent(id)}`
  if (kind.startsWith('hearing')) return `/hearings?hearing=${encodeURIComponent(id)}`
  if (kind === 'case' || kind === 'case_update') return `/cases/${encodeURIComponent(id)}`
  if (kind === 'client') return `/clients/${encodeURIComponent(id)}`
  return null
}
