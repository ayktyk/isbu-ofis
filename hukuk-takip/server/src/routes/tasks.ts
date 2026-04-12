import { Router } from 'express'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tasks, cases } from '../db/schema.js'
import { validate } from '../middleware/validate.js'
import { authenticate } from '../middleware/auth.js'
import { createTaskSchema, updateTaskSchema } from '@hukuk-takip/shared'
import { getOwnedCase } from '../utils/ownership.js'
import { getSingleValue } from '../utils/request.js'

const router = Router()
router.use(authenticate)

// ─── GET /api/tasks ───────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
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

// ─── POST /api/tasks ──────────────────────────────────────────────────────────

router.post('/', validate(createTaskSchema), async (req, res) => {
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

  res.status(201).json(task)
})

// ─── PUT /api/tasks/:id ──────────────────────────────────────────────────────

router.put('/:id', validate(updateTaskSchema), async (req, res) => {
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

  const updateData: Record<string, unknown> = { ...req.body, updatedAt: new Date() }

  if (req.body.dueDate) updateData.dueDate = new Date(req.body.dueDate)
  if (req.body.status === 'completed') updateData.completedAt = new Date()

  const [updated] = await db
    .update(tasks)
    .set(updateData)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.userId)))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Görev bulunamadı.' })
    return
  }

  res.json(updated)
})

// ─── PATCH /api/tasks/:id/status — Hızlı durum değiştirme ────────────────────

router.patch('/:id/status', async (req, res) => {
  const taskId = getSingleValue(req.params.id)

  if (!taskId) {
    res.status(400).json({ error: 'Gecersiz gorev id.' })
    return
  }

  const { status } = req.body

  const updateData: Record<string, unknown> = { status, updatedAt: new Date() }
  if (status === 'completed') updateData.completedAt = new Date()

  const [updated] = await db
    .update(tasks)
    .set(updateData)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.userId)))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Görev bulunamadı.' })
    return
  }

  res.json(updated)
})

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
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

  res.json({ message: 'Görev silindi.' })
})

export default router
