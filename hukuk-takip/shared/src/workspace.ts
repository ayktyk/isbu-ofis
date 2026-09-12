import { z } from 'zod'

export const workflowSchema = z.object({
  stage: z.string().trim().max(120),
  waitingFor: z.string().trim().max(500),
  checkDate: z.string().date().nullable(),
  revision: z.number().int().min(0),
})
export const hearingReviewSchema = z.object({
  requestId: z.string().uuid(),
  result: z.enum(['completed', 'postponed']),
  note: z.string().trim().min(1, 'Sonuç notunu yazın').max(5000),
  nextDate: z.string().datetime({ offset: true }).nullable(),
  tasks: z.array(z.object({ title: z.string().trim().min(1).max(500), dueDate: z.string().datetime({ offset: true }).nullable() })).max(10),
})
export type Workflow = z.infer<typeof workflowSchema>
export type HearingReview = z.infer<typeof hearingReviewSchema>
export function matchesTrackingFilter(filter: string, status: string, tracking: { overdueCount: number; openCount: number }, workflow?: { waitingFor: string; checkDate: string | null } | null, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })) {
  if (!filter) return true
  if (['won', 'lost', 'settled', 'closed'].includes(status)) return false
  if (filter === 'overdue') return tracking.overdueCount > 0 || !!(workflow?.checkDate && workflow.checkDate < today)
  if (filter === 'waiting') return !!workflow?.waitingFor.trim()
  if (filter === 'unplanned') return tracking.openCount === 0 && !workflow?.checkDate
  if (filter === 'check') return !!workflow?.checkDate && workflow.checkDate <= today
  return true
}
