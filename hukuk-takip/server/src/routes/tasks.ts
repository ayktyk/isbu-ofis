import { Router, type Request, type Response } from 'express'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { cases, tasks } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createTaskSchema, updateTaskSchema } from '../../../shared/dist/index.js'
import { getOwnedCase } from '../utils/ownership.js'
import { getSingleValue } from '../utils/request.js'
import { deleteTaskFromGoogleCalendar, syncTaskToGoogleCalendar } from '../utils/googleCalendar.js'

const router = Router()
router.use(authenticate)

async function getTaskCaseTitle(userId: string, caseId?: string | null) {
  if (!caseId) {
    return null
  }

  const [caseRow] = await db
    .select({ title: cases.title })
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.userId, userId)))
    .limit(1)

  return caseRow?.title || null
}

router.get('/', async (req: Request, res: Response) => {
  const status = getSingleValue(req.query.status)
  const priority = getSingleValue(req.query.priority)

  const conditions = [eq(tasks.userId, req.user!.userId)]

  if (status) {
    conditions.push(eq(tasks.status, status as any))
  }
  if (priority) {
    conditions.push(eq(tasks.priority, priority as any))
  }

  const data = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      caseId: tasks.caseId,
      label: tasks.label,
      caseTitle: cases.title,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(cases, eq(tasks.caseId, cases.id))
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt))

  res.json(data)
})

router.post('/', validate(createTaskSchema), async (req: Request, res: Response) => {
  const { dueDate, caseId, label, ...rest } = req.body

  if (caseId) {
    const ownedCase = await getOwnedCase(req.user!.userId, caseId)
    if (!ownedCase) {
      res.status(404).json({ error: 'Dava bulunamadi.' })
      return
    }
  }

  const [task] = await db
    .insert(tasks)
    .values({
      ...rest,
      userId: req.user!.userId,
      caseId: caseId || null,
      label: label || null,
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning()

  try {
    await syncTaskToGoogleCalendar({
      taskId: task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      label: task.label,
      status: task.status,
      caseTitle: await getTaskCaseTitle(req.user!.userId, task.caseId),
    })
  } catch (error) {
    console.error('[GoogleCalendar] Task create sync failed', task.id, error)
  }

  res.status(201).json(task)
})

router.put('/:id', validate(updateTaskSchema), async (req: Request, res: Response) => {
  const taskId = getSingleValue(req.params.id)

  if (!taskId) {
    res.status(400).json({ error: 'Gecersiz gorev id.' })
    return
  }

  if (req.body.caseId) {
    const ownedCase = await getOwnedCase(req.user!.userId, req.body.caseId)
    if (!ownedCase) {
      res.status(404).json({ error: 'Dava bulunamadi.' })
      return
    }
  }

  const { dueDate, caseId, label, ...rest } = req.body
  const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() }

  if ('caseId' in req.body) updateData.caseId = caseId || null
  if ('label' in req.body) updateData.label = label || null
  if ('dueDate' in req.body) updateData.dueDate = dueDate ? new Date(dueDate) : null
  if (req.body.status === 'completed') updateData.completedAt = new Date()
  if (req.body.status && req.body.status !== 'completed') updateData.completedAt = null

  const [updated] = await db
    .update(tasks)
    .set(updateData)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.userId)))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Görev bulunamadı.' })
    return
  }

  try {
    await syncTaskToGoogleCalendar({
      taskId: updated.id,
      title: updated.title,
      description: updated.description,
      dueDate: updated.dueDate,
      label: updated.label,
      status: updated.status,
      caseTitle: await getTaskCaseTitle(req.user!.userId, updated.caseId),
    })
  } catch (error) {
    console.error('[GoogleCalendar] Task update sync failed', updated.id, error)
  }

  res.json(updated)
})

router.patch('/:id/status', async (req: Request, res: Response) => {
  const taskId = getSingleValue(req.params.id)

  if (!taskId) {
    res.status(400).json({ error: 'Gecersiz gorev id.' })
    return
  }

  const { status } = req.body

  const updateData: Record<string, unknown> = { status, updatedAt: new Date() }
  if (status === 'completed') updateData.completedAt = new Date()
  if (status && status !== 'completed') updateData.completedAt = null

  const [updated] = await db
    .update(tasks)
    .set(updateData)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.userId)))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Görev bulunamadı.' })
    return
  }

  try {
    await syncTaskToGoogleCalendar({
      taskId: updated.id,
      title: updated.title,
      description: updated.description,
      dueDate: updated.dueDate,
      label: updated.label,
      status: updated.status,
      caseTitle: await getTaskCaseTitle(req.user!.userId, updated.caseId),
    })
  } catch (error) {
    console.error('[GoogleCalendar] Task status sync failed', updated.id, error)
  }

  res.json(updated)
})

router.delete('/:id', async (req: Request, res: Response) => {
  const taskId = getSingleValue(req.params.id)

  if (!taskId) {
    res.status(400).json({ error: 'Gecersiz gorev id.' })
    return
  }

  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.userId)))
    .returning()

  if (!deleted) {
    res.status(404).json({ error: 'Görev bulunamadı.' })
    return
  }

  try {
    await deleteTaskFromGoogleCalendar(deleted.id)
  } catch (error) {
    console.error('[GoogleCalendar] Task delete sync failed', deleted.id, error)
  }

  res.json({ message: 'Görev silindi.' })
})

export default router
