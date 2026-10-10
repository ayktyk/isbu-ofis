import { Router, type Request, type Response } from 'express'
import { and, eq, gte, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { caseHearings, cases, clients } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createHearingSchema, updateHearingSchema } from '../../../shared/dist/index.js'
import { getOwnedCase, getOwnedHearing } from '../utils/ownership.js'
import { getSingleValue } from '../utils/request.js'
import { syncHearingCalendarSafe } from '../utils/hearingCalendar.js'
import { logDiaryEntry } from '../utils/diaryLog.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req: Request, res: Response) => {
  const upcoming = getSingleValue(req.query.upcoming)

  const conditions = [
    eq(cases.userId, req.user!.userId),
    isNull(cases.archivedAt),
    isNull(caseHearings.archivedAt),
  ]

  if (upcoming === 'true') {
    conditions.push(gte(caseHearings.hearingDate, new Date()))
  }

  const data = await db
    .select({
      id: caseHearings.id,
      caseId: caseHearings.caseId,
      hearingDate: caseHearings.hearingDate,
      courtRoom: caseHearings.courtRoom,
      judge: caseHearings.judge,
      result: caseHearings.result,
      notes: caseHearings.notes,
      nextHearingDate: caseHearings.nextHearingDate,
      caseTitle: cases.title,
      caseNumber: cases.caseNumber,
      courtName: cases.courtName,
      clientName: clients.fullName,
    })
    .from(caseHearings)
    .innerJoin(cases, eq(caseHearings.caseId, cases.id))
    .leftJoin(clients, eq(cases.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(caseHearings.hearingDate)

  res.json(data)
})

router.post('/', validate(createHearingSchema), async (req: Request, res: Response) => {
  const { caseId, hearingDate, ...rest } = req.body

  const ownedCase = await getOwnedCase(req.user!.userId, caseId)
  if (!ownedCase) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const [hearing] = await db
    .insert(caseHearings)
    .values({
      caseId,
      hearingDate: new Date(hearingDate),
      ...rest,
      updatedByActor: 'avukat',
    })
    .returning()

  void logDiaryEntry({
    caseId,
    userId: req.user!.userId,
    entryType: 'hearing_added',
    title: 'Duruşma eklendi',
    content: hearing.hearingDate
      ? `Tarih: ${new Date(hearing.hearingDate).toLocaleString('tr-TR')}${hearing.courtRoom ? ` • Salon: ${hearing.courtRoom}` : ''}`
      : 'Duruşma kaydı eklendi',
    linkedEntityType: 'hearing',
    linkedEntityId: hearing.id,
    occurredAt: hearing.createdAt ?? new Date(),
  })

  await syncHearingCalendarSafe(req.user!.userId, hearing.id, 'create')

  res.status(201).json(hearing)
})

router.put('/:id', validate(updateHearingSchema), async (req: Request, res: Response) => {
  const hearingId = getSingleValue(req.params.id)

  if (!hearingId) {
    res.status(400).json({ error: 'Gecersiz durusma id.' })
    return
  }

  const ownedHearing = await getOwnedHearing(req.user!.userId, hearingId)
  if (!ownedHearing) {
    res.status(404).json({ error: 'Duruşma bulunamadı.' })
    return
  }

  if (req.body.caseId) {
    const ownedCase = await getOwnedCase(req.user!.userId, req.body.caseId)
    if (!ownedCase) {
      res.status(404).json({ error: 'Dava bulunamadi.' })
      return
    }
  }

  // Eski hali — diary log için "result önceden boş muydu?" kontrolü
  const [previous] = await db
    .select({ result: caseHearings.result, caseId: caseHearings.caseId })
    .from(caseHearings)
    .where(eq(caseHearings.id, hearingId))
    .limit(1)

  const updateData: Record<string, unknown> = { ...req.body, updatedAt: new Date(), updatedByActor: 'avukat' }

  if (req.body.hearingDate) {
    updateData.hearingDate = new Date(req.body.hearingDate)
  }
  if (req.body.nextHearingDate) {
    updateData.nextHearingDate = new Date(req.body.nextHearingDate)
  }

  const [updated] = await db
    .update(caseHearings)
    .set(updateData)
    .where(and(eq(caseHearings.id, hearingId), isNull(caseHearings.archivedAt)))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Duruşma bulunamadı.' })
    return
  }

  // Result değişti veya yeni girildi ise → günlüğe "duruşma sonucu" girdisi düşür
  const newResult = (req.body.result ?? updated.result) as string | null | undefined
  if (newResult && newResult !== previous?.result) {
    void logDiaryEntry({
      caseId: updated.caseId,
      userId: req.user!.userId,
      entryType: 'hearing_completed',
      title: 'Duruşma sonucu',
      content: newResult,
      linkedEntityType: 'hearing',
      linkedEntityId: updated.id,
    })
  }

  await syncHearingCalendarSafe(req.user!.userId, updated.id, 'update')

  res.json(updated)
})

router.delete('/:id', async (req: Request, res: Response) => {
  const hearingId = getSingleValue(req.params.id)

  if (!hearingId) {
    res.status(400).json({ error: 'Gecersiz durusma id.' })
    return
  }

  const ownedHearing = await getOwnedHearing(req.user!.userId, hearingId)
  if (!ownedHearing) {
    res.status(404).json({ error: 'Duruşma bulunamadı.' })
    return
  }

  const [deleted] = await db
    .update(caseHearings)
    .set({ archivedAt: new Date(), updatedAt: new Date(), updatedByActor: 'avukat' })
    .where(and(eq(caseHearings.id, hearingId), isNull(caseHearings.archivedAt)))
    .returning()

  if (!deleted) {
    res.status(404).json({ error: 'Duruşma bulunamadı.' })
    return
  }

  res.json({ message: 'Duruşma arşivlendi.' })
})

export default router
