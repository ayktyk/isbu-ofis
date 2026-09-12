export interface WorkItem {
  id: string
  title: string
  dueDate?: string | null
  kind: 'task' | 'deadline' | 'diary'
}

export function compareDueDates(a: { dueDate?: string | null }, b: { dueDate?: string | null }) {
  const time = (value?: string | null) => {
    const parsed = value ? Date.parse(value) : NaN
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
  }
  return time(a.dueDate) - time(b.dueDate)
}

export function getOpenWork(
  tasks: { id: string; title: string; status: string; dueDate?: string | null; isDeadline?: boolean }[],
  diary: { id: string; nextStep: string | null; nextStepDone: boolean; nextStepDueDate: string | null; archivedAt?: string | null }[],
): WorkItem[] {
  return [
    ...tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').map(t => ({
      id: t.id, title: t.title, dueDate: t.dueDate, kind: t.isDeadline ? 'deadline' as const : 'task' as const,
    })),
    ...diary.filter(d => d.nextStep && !d.nextStepDone && !d.archivedAt).map(d => ({
      id: d.id, title: d.nextStep!, dueDate: d.nextStepDueDate, kind: 'diary' as const,
    })),
  ].sort(compareDueDates)
}
