// Read-only, page-scoped aggregation. Backup receipt: backups/README.md, 2026-09-12.
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { summarizeCaseTracking, type CaseTrackingSummary } from '@hukuk-takip/shared'
import { cases, tasks, caseDiaryEntries, caseHearings, notes } from '../db/schema.js'
import type { db } from '../db/index.js'

export async function loadCaseTracking(database: Pick<typeof db, 'select'>, userId: string, caseIds: string[]): Promise<Record<string, CaseTrackingSummary>> {
  if (!caseIds.length) return {}
  const owned = and(eq(cases.userId, userId), isNull(cases.archivedAt), inArray(cases.id, caseIds))
  const [taskRows, diaryRows, hearingRows, noteRows] = await Promise.all([
    database.select({ id: tasks.id, caseId: tasks.caseId, title: tasks.title, status: tasks.status, dueDate: tasks.dueDate, isDeadline: tasks.isDeadline })
      .from(tasks).innerJoin(cases, eq(tasks.caseId, cases.id))
      .where(and(owned, isNull(tasks.archivedAt), inArray(tasks.status, ['pending', 'in_progress']))),
    database.select({ id: caseDiaryEntries.id, caseId: caseDiaryEntries.caseId, entryType: caseDiaryEntries.entryType, content: caseDiaryEntries.content, title: caseDiaryEntries.title, nextStep: caseDiaryEntries.nextStep, nextStepDone: caseDiaryEntries.nextStepDone, nextStepDueDate: caseDiaryEntries.nextStepDueDate, occurredAt: caseDiaryEntries.occurredAt })
      .from(caseDiaryEntries).innerJoin(cases, eq(caseDiaryEntries.caseId, cases.id))
      .where(and(owned, isNull(caseDiaryEntries.archivedAt))),
    database.select({ id: caseHearings.id, caseId: caseHearings.caseId, hearingDate: caseHearings.hearingDate, result: caseHearings.result })
      .from(caseHearings).innerJoin(cases, eq(caseHearings.caseId, cases.id))
      .where(and(owned, isNull(caseHearings.archivedAt), eq(caseHearings.result, 'pending'))),
    database.select({ id: notes.id, caseId: notes.caseId, content: notes.content, createdAt: notes.createdAt })
      .from(notes).innerJoin(cases, eq(notes.caseId, cases.id))
      .where(and(owned, isNull(notes.archivedAt))),
  ])
  return summarizeCaseTracking(caseIds, { tasks: taskRows, diary: diaryRows, hearings: hearingRows, notes: noteRows })
}
