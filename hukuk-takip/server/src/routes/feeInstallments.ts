import { Router, type Request, type Response } from 'express'
import { and, asc, eq, isNull } from 'drizzle-orm'
// Diger tum server route'lari paylasilan semalari bu goreli yol ile cagiriyor.
// Bare specifier ('@hukuk-takip/shared') calisma aninda workspace symlink'ine
// bagimli; derleme ortamina gore cozulemeyebilir. Konvansiyona uyuldu.
import {
  createFeeInstallmentSchema,
  updateFeeInstallmentSchema,
} from '../../../shared/dist/index.js'
import { db } from '../db/index.js'
import { caseFeeInstallments, cases } from '../db/schema.js'
import { validate } from '../middleware/validate.js'
import { authenticate } from '../middleware/auth.js'
import { getSingleValue } from '../utils/request.js'

const router = Router()
router.use(authenticate)

/** Dava gercekten bu kullaniciya mi ait? Her taksit islemi once bunu dogrular. */
async function ownsCase(caseId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.userId, userId), isNull(cases.archivedAt)))
    .limit(1)
  return rows.length > 0
}

/** Taksitin bagli oldugu davayi bulur ve sahiplik dogrular. */
async function ownsInstallment(installmentId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ caseId: caseFeeInstallments.caseId })
    .from(caseFeeInstallments)
    .where(eq(caseFeeInstallments.id, installmentId))
    .limit(1)

  if (!rows[0]) return false
  return ownsCase(rows[0].caseId, userId)
}

// ─── GET /api/cases/:caseId/fee-installments ─────────────────────────────────
router.get('/cases/:caseId/fee-installments', async (req: Request, res: Response) => {
  const caseId = getSingleValue(req.params.caseId)
  if (!caseId || !(await ownsCase(caseId, req.user!.userId))) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const rows = await db
    .select()
    .from(caseFeeInstallments)
    .where(and(eq(caseFeeInstallments.caseId, caseId), isNull(caseFeeInstallments.archivedAt)))
    .orderBy(asc(caseFeeInstallments.seq), asc(caseFeeInstallments.dueDate))

  res.json(rows)
})

// ─── POST /api/cases/:caseId/fee-installments ────────────────────────────────
router.post(
  '/cases/:caseId/fee-installments',
  validate(createFeeInstallmentSchema),
  async (req: Request, res: Response) => {
    const caseId = getSingleValue(req.params.caseId)
    if (!caseId || !(await ownsCase(caseId, req.user!.userId))) {
      res.status(404).json({ error: 'Dava bulunamadi.' })
      return
    }

    const { seq, amount, dueDate, status, note } = req.body

    const [created] = await db
      .insert(caseFeeInstallments)
      .values({
        caseId,
        seq: seq ?? 1,
        amount,
        dueDate,
        status: status || 'pending',
        note: note || null,
      })
      .returning()

    res.status(201).json(created)
  }
)

// ─── PUT /api/fee-installments/:id ───────────────────────────────────────────
router.put(
  '/fee-installments/:id',
  validate(updateFeeInstallmentSchema),
  async (req: Request, res: Response) => {
    const id = getSingleValue(req.params.id)
    if (!id) {
      res.status(400).json({ error: 'Gecersiz taksit id.' })
      return
    }

    if (!(await ownsInstallment(id, req.user!.userId))) {
      res.status(404).json({ error: 'Taksit bulunamadi.' })
      return
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (req.body.amount !== undefined) patch.amount = req.body.amount
    if (req.body.dueDate !== undefined) patch.dueDate = req.body.dueDate
    if (req.body.status !== undefined) patch.status = req.body.status
    if (req.body.seq !== undefined) patch.seq = req.body.seq
    if (req.body.note !== undefined) patch.note = req.body.note || null
    if (req.body.collectionId !== undefined) patch.collectionId = req.body.collectionId || null

    const [updated] = await db
      .update(caseFeeInstallments)
      .set(patch)
      .where(eq(caseFeeInstallments.id, id))
      .returning()

    res.json(updated)
  }
)

// ─── DELETE /api/fee-installments/:id ────────────────────────────────────────
// ARSIVLER, satiri silmez. Veri koruma kurali: fiziksel DELETE kod yolu yok.
router.delete('/fee-installments/:id', async (req: Request, res: Response) => {
  const id = getSingleValue(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'Gecersiz taksit id.' })
    return
  }

  if (!(await ownsInstallment(id, req.user!.userId))) {
    res.status(404).json({ error: 'Taksit bulunamadi.' })
    return
  }

  await db
    .update(caseFeeInstallments)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(caseFeeInstallments.id, id))

  res.json({ success: true })
})

export default router
