import { Router } from 'express'
import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import {
  createDiaryEntrySchema,
  setNextStepDoneSchema,
  updateDiaryEntrySchema,
} from '../../../shared/dist/index.js'
import { db } from '../db/index.js'
import { caseDiaryEntries, cases } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { getOwnedCase } from '../utils/ownership.js'
import { getSingleValue } from '../utils/request.js'

const router = Router()
router.use(authenticate)

function normalizeOptional(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function normalizeOccurredAt(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

// GET /api/cases/:caseId/diary — bir davanın tüm günlük girdileri (yenisi en üstte).
router.get('/cases/:caseId/diary', async (req, res) => {
  const caseId = getSingleValue(req.params.caseId)
  if (!caseId) {
    res.status(400).json({ error: 'Gecersiz dava id.' })
    return
  }

  const ownedCase = await getOwnedCase(req.user!.userId, caseId)
  if (!ownedCase) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const entries = await db
    .select()
    .from(caseDiaryEntries)
    .where(and(eq(caseDiaryEntries.caseId, caseId), isNull(caseDiaryEntries.archivedAt)))
    .orderBy(desc(caseDiaryEntries.occurredAt), desc(caseDiaryEntries.createdAt))

  res.json(entries)
})

// GET /api/cases/:caseId/next-step — bu davanın açık (tamamlanmamış) en güncel sonraki adımı.
router.get('/cases/:caseId/next-step', async (req, res) => {
  const caseId = getSingleValue(req.params.caseId)
  if (!caseId) {
    res.status(400).json({ error: 'Gecersiz dava id.' })
    return
  }

  const ownedCase = await getOwnedCase(req.user!.userId, caseId)
  if (!ownedCase) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const [open] = await db
    .select({
      id: caseDiaryEntries.id,
      nextStep: caseDiaryEntries.nextStep,
      nextStepDueDate: caseDiaryEntries.nextStepDueDate,
      occurredAt: caseDiaryEntries.occurredAt,
      entryType: caseDiaryEntries.entryType,
    })
    .from(caseDiaryEntries)
    .where(
      and(
        eq(caseDiaryEntries.caseId, caseId),
        isNull(caseDiaryEntries.archivedAt),
        isNotNull(caseDiaryEntries.nextStep),
        eq(caseDiaryEntries.nextStepDone, false),
      ),
    )
    .orderBy(
      // Tarihi yaklaşmış olan önce gelsin, tarih yoksa en yeni occurredAt.
      asc(sql`COALESCE(${caseDiaryEntries.nextStepDueDate}, '9999-12-31'::date)`),
      desc(caseDiaryEntries.occurredAt),
    )
    .limit(1)

  res.json(open ?? null)
})

// POST /api/cases/:caseId/diary — yeni manuel günlük girdisi.
router.post('/cases/:caseId/diary', validate(createDiaryEntrySchema), async (req, res) => {
  const caseId = getSingleValue(req.params.caseId)
  if (!caseId) {
    res.status(400).json({ error: 'Gecersiz dava id.' })
    return
  }

  const ownedCase = await getOwnedCase(req.user!.userId, caseId)
  if (!ownedCase) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const occurredAt = normalizeOccurredAt(req.body.occurredAt)

  const [entry] = await db
    .insert(caseDiaryEntries)
    .values({
      caseId,
      userId: req.user!.userId,
      entryType: 'manual',
      title: normalizeOptional(req.body.title),
      content: normalizeOptional(req.body.content),
      nextStep: normalizeOptional(req.body.nextStep),
      nextStepDueDate: normalizeDate(req.body.nextStepDueDate),
      occurredAt: occurredAt ?? new Date(),
    })
    .returning()

  res.status(201).json(entry)
})

// PUT /api/diary/:entryId — sadece manuel girdi düzenlenebilir.
router.put('/diary/:entryId', validate(updateDiaryEntrySchema), async (req, res) => {
  const entryId = getSingleValue(req.params.entryId)
  if (!entryId) {
    res.status(400).json({ error: 'Gecersiz girdi id.' })
    return
  }

  // Önce girdiyi al ve sahibi olduğunu doğrula (case üzerinden ownership).
  const [entry] = await db
    .select()
    .from(caseDiaryEntries)
    .innerJoin(cases, eq(caseDiaryEntries.caseId, cases.id))
    .where(
      and(
        eq(caseDiaryEntries.id, entryId),
        eq(cases.userId, req.user!.userId),
        isNull(caseDiaryEntries.archivedAt),
      ),
    )
    .limit(1)

  if (!entry) {
    res.status(404).json({ error: 'Günlük girdisi bulunamadı.' })
    return
  }
  if (entry.case_diary_entries.entryType !== 'manual') {
    res.status(403).json({ error: 'Otomatik girdiler düzenlenemez.' })
    return
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (req.body.title !== undefined) updates.title = normalizeOptional(req.body.title)
  if (req.body.content !== undefined) updates.content = normalizeOptional(req.body.content)
  if (req.body.nextStep !== undefined) updates.nextStep = normalizeOptional(req.body.nextStep)
  if (req.body.nextStepDueDate !== undefined) {
    updates.nextStepDueDate = normalizeDate(req.body.nextStepDueDate)
  }
  if (req.body.occurredAt !== undefined) {
    const parsed = normalizeOccurredAt(req.body.occurredAt)
    if (parsed) updates.occurredAt = parsed
  }

  const [updated] = await db
    .update(caseDiaryEntries)
    .set(updates)
    .where(eq(caseDiaryEntries.id, entryId))
    .returning()

  res.json(updated)
})

// PATCH /api/diary/:entryId/next-step — "tamamlandı" toggle.
router.patch(
  '/diary/:entryId/next-step',
  validate(setNextStepDoneSchema),
  async (req, res) => {
    const entryId = getSingleValue(req.params.entryId)
    if (!entryId) {
      res.status(400).json({ error: 'Gecersiz girdi id.' })
      return
    }

    const [entry] = await db
      .select()
      .from(caseDiaryEntries)
      .innerJoin(cases, eq(caseDiaryEntries.caseId, cases.id))
      .where(
        and(
          eq(caseDiaryEntries.id, entryId),
          eq(cases.userId, req.user!.userId),
          isNull(caseDiaryEntries.archivedAt),
        ),
      )
      .limit(1)

    if (!entry) {
      res.status(404).json({ error: 'Günlük girdisi bulunamadı.' })
      return
    }
    if (!entry.case_diary_entries.nextStep) {
      res.status(400).json({ error: 'Bu girdide sonraki adım tanımlı değil.' })
      return
    }

    const [updated] = await db
      .update(caseDiaryEntries)
      .set({ nextStepDone: !!req.body.done, updatedAt: new Date() })
      .where(eq(caseDiaryEntries.id, entryId))
      .returning()

    res.json(updated)
  },
)

// DELETE /api/diary/:entryId — soft delete (sadece manuel girdiler için).
// Veri koruma kuralı gereği hard delete YOK.
router.delete('/diary/:entryId', async (req, res) => {
  const entryId = getSingleValue(req.params.entryId)
  if (!entryId) {
    res.status(400).json({ error: 'Gecersiz girdi id.' })
    return
  }

  const [entry] = await db
    .select()
    .from(caseDiaryEntries)
    .innerJoin(cases, eq(caseDiaryEntries.caseId, cases.id))
    .where(
      and(
        eq(caseDiaryEntries.id, entryId),
        eq(cases.userId, req.user!.userId),
        isNull(caseDiaryEntries.archivedAt),
      ),
    )
    .limit(1)

  if (!entry) {
    res.status(404).json({ error: 'Günlük girdisi bulunamadı.' })
    return
  }
  if (entry.case_diary_entries.entryType !== 'manual') {
    res.status(403).json({ error: 'Otomatik girdiler silinemez (arşivlenemez).' })
    return
  }

  const [archived] = await db
    .update(caseDiaryEntries)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(caseDiaryEntries.id, entryId))
    .returning()

  res.json({ message: 'Girdi arşivlendi.', id: archived.id })
})

export default router
