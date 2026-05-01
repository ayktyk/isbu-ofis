import { Router, type Request, type Response } from 'express'
import { and, asc, desc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { cases, tasks } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  createTaskSchema,
  updateTaskSchema,
  previewDeadlineSchema,
  LEGAL_DEADLINE_TEMPLATES,
  findTemplate,
  computeLegalDeadline,
} from '../../../shared/dist/index.js'
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

const taskSelectColumns = {
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
  // Süreli iş alanları
  isDeadline: tasks.isDeadline,
  deadlineTemplateKey: tasks.deadlineTemplateKey,
  deadlineCategory: tasks.deadlineCategory,
  deadlineSeverity: tasks.deadlineSeverity,
  triggerEventDate: tasks.triggerEventDate,
  triggerEventLabel: tasks.triggerEventLabel,
  calculatedDueDate: tasks.calculatedDueDate,
  adjustedForHoliday: tasks.adjustedForHoliday,
  legalBasis: tasks.legalBasis,
  completionEvidence: tasks.completionEvidence,
}

function parseBoolFlag(value: unknown): boolean | null {
  const v = getSingleValue(value)
  if (v === undefined || v === null || v === '') return null
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return null
}

// ---------- Süreli iş yardımcı endpoint'leri (önce gelir, /:id ile çakışmaması için) ----------

router.get('/deadlines/templates', (_req: Request, res: Response) => {
  // Statik liste — frontend cache'leyebilir.
  res.json(LEGAL_DEADLINE_TEMPLATES)
})

router.post(
  '/deadlines/preview',
  validate(previewDeadlineSchema),
  (req: Request, res: Response) => {
    const { templateKey, triggerEventDate } = req.body as {
      templateKey: string
      triggerEventDate: string
    }
    const tpl = findTemplate(templateKey)
    if (!tpl) {
      res.status(400).json({ error: 'Süre şablonu bulunamadı.' })
      return
    }
    const trigger = new Date(triggerEventDate)
    if (Number.isNaN(trigger.getTime())) {
      res.status(400).json({ error: 'Geçersiz tetikleyici tarih.' })
      return
    }
    const result = computeLegalDeadline(tpl, trigger)
    res.json({
      template: tpl,
      rawDueDate: result.rawDueDate.toISOString().slice(0, 10),
      adjustedDueDate: result.adjustedDueDate.toISOString().slice(0, 10),
      wasShifted: result.wasShifted,
    })
  }
)

router.get('/deadlines/critical', async (req: Request, res: Response) => {
  const withinDaysRaw = Number.parseInt(getSingleValue(req.query.withinDays) || '7', 10)
  const withinDays = Number.isFinite(withinDaysRaw) ? Math.min(Math.max(withinDaysRaw, 1), 365) : 7

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + withinDays)

  const rows = await db
    .select(taskSelectColumns)
    .from(tasks)
    .leftJoin(cases, eq(tasks.caseId, cases.id))
    .where(
      and(
        eq(tasks.userId, req.user!.userId),
        eq(tasks.isDeadline, true),
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, start),
        lte(tasks.dueDate, end),
        inArray(tasks.status, ['pending', 'in_progress'])
      )
    )
    .orderBy(asc(tasks.dueDate))

  res.json(rows)
})

// ---------- Genel görev endpoint'leri ----------

router.get('/', async (req: Request, res: Response) => {
  const status = getSingleValue(req.query.status)
  const priority = getSingleValue(req.query.priority)
  const category = getSingleValue(req.query.category)
  const severity = getSingleValue(req.query.severity)
  const isDeadlineFilter = parseBoolFlag(req.query.isDeadline)
  const dueWithinRaw = getSingleValue(req.query.dueWithinDays)
  const dueWithinDays =
    dueWithinRaw !== undefined && dueWithinRaw !== ''
      ? Number.parseInt(dueWithinRaw, 10)
      : null

  const conditions = [eq(tasks.userId, req.user!.userId)]

  if (status) {
    conditions.push(eq(tasks.status, status as any))
  }
  if (priority) {
    conditions.push(eq(tasks.priority, priority as any))
  }
  if (isDeadlineFilter !== null) {
    conditions.push(eq(tasks.isDeadline, isDeadlineFilter))
  }
  if (category) {
    conditions.push(eq(tasks.deadlineCategory, category))
  }
  if (severity) {
    conditions.push(eq(tasks.deadlineSeverity, severity))
  }
  if (dueWithinDays !== null && Number.isFinite(dueWithinDays) && dueWithinDays > 0) {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(start)
    end.setDate(end.getDate() + dueWithinDays)
    conditions.push(isNotNull(tasks.dueDate))
    conditions.push(gte(tasks.dueDate, start))
    conditions.push(lte(tasks.dueDate, end))
  }

  const data = await db
    .select(taskSelectColumns)
    .from(tasks)
    .leftJoin(cases, eq(tasks.caseId, cases.id))
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt))

  res.json(data)
})

router.post('/', validate(createTaskSchema), async (req: Request, res: Response) => {
  const {
    dueDate,
    caseId,
    label,
    triggerEventDate,
    calculatedDueDate,
    isDeadline,
    deadlineTemplateKey,
    deadlineCategory,
    deadlineSeverity,
    triggerEventLabel,
    adjustedForHoliday,
    legalBasis,
    ...rest
  } = req.body

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
      isDeadline: isDeadline === true,
      deadlineTemplateKey: deadlineTemplateKey || null,
      deadlineCategory: deadlineCategory || null,
      deadlineSeverity: deadlineSeverity || null,
      triggerEventDate: triggerEventDate || null,
      triggerEventLabel: triggerEventLabel || null,
      calculatedDueDate: calculatedDueDate || null,
      adjustedForHoliday: adjustedForHoliday === true,
      legalBasis: legalBasis || null,
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

  const {
    dueDate,
    caseId,
    label,
    triggerEventDate,
    calculatedDueDate,
    completionEvidence,
    ...rest
  } = req.body
  const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() }

  if ('caseId' in req.body) updateData.caseId = caseId || null
  if ('label' in req.body) updateData.label = label || null
  if ('dueDate' in req.body) updateData.dueDate = dueDate ? new Date(dueDate) : null
  if ('triggerEventDate' in req.body) updateData.triggerEventDate = triggerEventDate || null
  if ('calculatedDueDate' in req.body) updateData.calculatedDueDate = calculatedDueDate || null
  if ('completionEvidence' in req.body) updateData.completionEvidence = completionEvidence || null
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

  const { status, completionEvidence } = req.body as {
    status?: string
    completionEvidence?: string
  }

  // Süreli iş tamamlanırken kanıt notu zorunlu
  if (status === 'completed') {
    const [existing] = await db
      .select({ isDeadline: tasks.isDeadline })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.userId)))
      .limit(1)
    if (existing?.isDeadline) {
      const trimmed = (completionEvidence || '').trim()
      if (trimmed.length < 5) {
        res.status(400).json({
          error: 'Süreli iş tamamlanırken en az 5 karakterlik kanıt notu zorunludur.',
          field: 'completionEvidence',
        })
        return
      }
    }
  }

  const updateData: Record<string, unknown> = { status, updatedAt: new Date() }
  if (status === 'completed') updateData.completedAt = new Date()
  if (status && status !== 'completed') updateData.completedAt = null
  if (completionEvidence !== undefined) updateData.completionEvidence = completionEvidence || null

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
