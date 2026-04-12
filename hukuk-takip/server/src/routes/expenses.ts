import { Router } from 'express'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { expenses, cases } from '../db/schema.js'
import { validate } from '../middleware/validate.js'
import { authenticate } from '../middleware/auth.js'
import { createExpenseSchema, updateExpenseSchema } from '@hukuk-takip/shared'
import { getOwnedCase } from '../utils/ownership.js'
import { getSingleValue } from '../utils/request.js'

const router = Router()
router.use(authenticate)

// ─── GET /api/expenses ────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const caseId = getSingleValue(req.query.caseId)
  const conditions = [eq(expenses.userId, req.user!.userId)]
  if (caseId) {
    conditions.push(eq(expenses.caseId, caseId))
  }

  const data = await db
    .select({
      id: expenses.id,
      caseId: expenses.caseId,
      type: expenses.type,
      description: expenses.description,
      amount: expenses.amount,
      currency: expenses.currency,
      expenseDate: expenses.expenseDate,
      isBillable: expenses.isBillable,
      caseTitle: cases.title,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .leftJoin(cases, eq(expenses.caseId, cases.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.createdAt))

  res.json(data)
})

// ─── POST /api/expenses ──────────────────────────────────────────────────────

router.post('/', validate(createExpenseSchema), async (req, res) => {
  const ownedCase = await getOwnedCase(req.user!.userId, req.body.caseId)
  if (!ownedCase) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const [expense] = await db
    .insert(expenses)
    .values({
      ...req.body,
      userId: req.user!.userId,
    })
    .returning()

  res.status(201).json(expense)
})

// ─── PUT /api/expenses/:id ───────────────────────────────────────────────────

router.put('/:id', validate(updateExpenseSchema), async (req, res) => {
  const expenseId = getSingleValue(req.params.id)

  if (!expenseId) {
    res.status(400).json({ error: 'Gecersiz masraf id.' })
    return
  }

  if (req.body.caseId) {
    const ownedCase = await getOwnedCase(req.user!.userId, req.body.caseId)
    if (!ownedCase) {
      res.status(404).json({ error: 'Dava bulunamadi.' })
      return
    }
  }

  const [updated] = await db
    .update(expenses)
    .set(req.body)
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, req.user!.userId)))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Masraf bulunamadı.' })
    return
  }

  res.json(updated)
})

// ─── DELETE /api/expenses/:id ────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  const expenseId = getSingleValue(req.params.id)

  if (!expenseId) {
    res.status(400).json({ error: 'Gecersiz masraf id.' })
    return
  }

  const [deleted] = await db
    .delete(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, req.user!.userId)))
    .returning()

  if (!deleted) {
    res.status(404).json({ error: 'Masraf bulunamadı.' })
    return
  }

  res.json({ message: 'Masraf silindi.' })
})

export default router
