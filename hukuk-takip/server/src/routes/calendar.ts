import { Router, type Request, type Response } from 'express'
import { and, eq, isNotNull, ne } from 'drizzle-orm'
import { db } from '../db/index.js'
import { caseHearings, cases, clients, tasks } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import {
  getCalendarIntegrationStatus,
  syncHearingToGoogleCalendar,
  syncTaskToGoogleCalendar,
} from '../utils/googleCalendar.js'

const router = Router()
router.use(authenticate)

router.get('/integration', (_req: Request, res: Response) => {
  res.json(getCalendarIntegrationStatus())
})

router.post('/resync', async (req: Request, res: Response) => {
  const status = getCalendarIntegrationStatus()

  if (!status.configured) {
    res.status(400).json({ error: 'Google Calendar henuz yapilandirilmamis.' })
    return
  }

  const taskRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      dueDate: tasks.dueDate,
      label: tasks.label,
      status: tasks.status,
      caseTitle: cases.title,
    })
    .from(tasks)
    .leftJoin(cases, eq(tasks.caseId, cases.id))
    .where(
      and(
        eq(tasks.userId, req.user!.userId),
        isNotNull(tasks.dueDate),
        ne(tasks.status, 'completed'),
        ne(tasks.status, 'cancelled')
      )
    )

  const hearingRows = await db
    .select({
      id: caseHearings.id,
      hearingDate: caseHearings.hearingDate,
      result: caseHearings.result,
      notes: caseHearings.notes,
      courtRoom: caseHearings.courtRoom,
      judge: caseHearings.judge,
      caseTitle: cases.title,
      caseNumber: cases.caseNumber,
      courtName: cases.courtName,
      clientName: clients.fullName,
    })
    .from(caseHearings)
    .innerJoin(cases, eq(caseHearings.caseId, cases.id))
    .leftJoin(clients, eq(cases.clientId, clients.id))
    .where(
      and(
        eq(cases.userId, req.user!.userId),
        ne(caseHearings.result, 'completed'),
        ne(caseHearings.result, 'cancelled')
      )
    )

  const failures: string[] = []
  let syncedTasks = 0
  let syncedHearings = 0

  for (const task of taskRows) {
    try {
      await syncTaskToGoogleCalendar({
        taskId: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        label: task.label,
        status: task.status,
        caseTitle: task.caseTitle,
      })
      syncedTasks += 1
    } catch (error) {
      failures.push(`task:${task.id}`)
      console.error('[GoogleCalendar] Task resync failed', task.id, error)
    }
  }

  for (const hearing of hearingRows) {
    try {
      await syncHearingToGoogleCalendar({
        hearingId: hearing.id,
        hearingDate: hearing.hearingDate,
        result: hearing.result,
        notes: hearing.notes,
        courtRoom: hearing.courtRoom,
        judge: hearing.judge,
        caseTitle: hearing.caseTitle,
        caseNumber: hearing.caseNumber,
        courtName: hearing.courtName,
        clientName: hearing.clientName,
      })
      syncedHearings += 1
    } catch (error) {
      failures.push(`hearing:${hearing.id}`)
      console.error('[GoogleCalendar] Hearing resync failed', hearing.id, error)
    }
  }

  res.json({
    configured: true,
    syncedTasks,
    syncedHearings,
    failedCount: failures.length,
    failures,
  })
})

export default router
