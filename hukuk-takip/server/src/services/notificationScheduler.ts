import { and, eq, gte, lte, isNotNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { caseHearings, tasks, notifications, cases } from '../db/schema.js'

// 3 gün öncesinden bildirim üret. Aynı hatirlatma icin ikinci bildirim olusturma.
export async function runReminderScan(): Promise<{ hearings: number; taskCount: number; skipped: number }> {
  const now = new Date()
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const threeDaysStart = new Date(threeDaysLater)
  threeDaysStart.setHours(0, 0, 0, 0)
  const threeDaysEnd = new Date(threeDaysLater)
  threeDaysEnd.setHours(23, 59, 59, 999)

  let hearingCount = 0
  let taskCount = 0
  let skipped = 0

  // --- Duruşmalar ---
  const upcomingHearings = await db
    .select({
      id: caseHearings.id,
      caseId: caseHearings.caseId,
      hearingDate: caseHearings.hearingDate,
      caseTitle: cases.title,
      userId: cases.userId,
    })
    .from(caseHearings)
    .innerJoin(cases, eq(caseHearings.caseId, cases.id))
    .where(
      and(
        gte(caseHearings.hearingDate, threeDaysStart),
        lte(caseHearings.hearingDate, threeDaysEnd)
      )
    )

  for (const hearing of upcomingHearings) {
    // Duplicate check: bu duruşma için bu kullanıcıya hearing tipi bildirim var mı?
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, hearing.userId),
          eq(notifications.type, 'hearing'),
          eq(notifications.relatedId, hearing.id),
          eq(notifications.relatedType, 'hearing')
        )
      )
      .limit(1)

    if (existing.length > 0) {
      skipped++
      continue
    }

    const hearingDateStr = new Date(hearing.hearingDate).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    await db.insert(notifications).values({
      userId: hearing.userId,
      type: 'hearing',
      title: 'Duruşma Hatırlatması',
      message: `"${hearing.caseTitle}" davası için 3 gün sonra (${hearingDateStr}) duruşma var.`,
      relatedId: hearing.id,
      relatedType: 'hearing',
      isRead: false,
      scheduledFor: hearing.hearingDate,
    })
    hearingCount++
  }

  // --- Görevler ---
  const upcomingTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, threeDaysStart),
        lte(tasks.dueDate, threeDaysEnd),
        eq(tasks.status, 'pending')
      )
    )

  for (const task of upcomingTasks) {
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, task.userId),
          eq(notifications.type, 'task'),
          eq(notifications.relatedId, task.id),
          eq(notifications.relatedType, 'task')
        )
      )
      .limit(1)

    if (existing.length > 0) {
      skipped++
      continue
    }

    const dueDateStr = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString('tr-TR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : ''

    await db.insert(notifications).values({
      userId: task.userId,
      type: 'task',
      title: 'Görev Hatırlatması',
      message: `"${task.title}" görevi için son 3 gün kaldı.${dueDateStr ? ` Bitiş: ${dueDateStr}` : ''}`,
      relatedId: task.id,
      relatedType: 'task',
      isRead: false,
      scheduledFor: task.dueDate,
    })
    taskCount++
  }

  return { hearings: hearingCount, taskCount, skipped }
}
