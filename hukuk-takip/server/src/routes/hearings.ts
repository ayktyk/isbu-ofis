import { Router, type Request, type Response } from 'express'
import { and, eq, gte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { caseHearings, cases, clients } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createHearingSchema, updateHearingSchema } from '../../../shared/dist/index.js'
import { getOwnedCase, getOwnedHearing } from '../utils/ownership.js'
import { getSingleValue } from '../utils/request.js'
import { deleteHearingFromGoogleCalendar, syncHearingToGoogleCalendar } from '../utils/googleCalendar.js'

const router = Router()
router.use(authenticate)

async function getHearingCalendarContext(userId: string, hearingId: string) {
  const [hearingRow] = await db
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
    .where(and(eq(caseHearings.id, hearingId), eq(cases.userId, userId)))
    .limit(1)

  return hearingRow ?? null
}

router.get('/', async (req: Request, res: Response) => {
  const upcoming = getSingleValue(req.query.upcoming)

  const conditions = [eq(cases.userId, req.user!.userId)]

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
    })
    .returning()

  try {
    const hearingContext = await getHearingCalendarContext(req.user!.userId, hearing.id)
    if (hearingContext) {
      await syncHearingToGoogleCalendar({
        hearingId: hearingContext.id,
        hearingDate: hearingContext.hearingDate,
        result: hearingContext.result,
        notes: hearingContext.notes,
        courtRoom: hearingContext.courtRoom,
        judge: hearingContext.judge,
        caseTitle: hearingContext.caseTitle,
        caseNumber: hearingContext.caseNumber,
        courtName: hearingContext.courtName,
        clientName: hearingContext.clientName,
      })
    }
  } catch (error) {
    console.error('[GoogleCalendar] Hearing create sync failed', hearing.id, error)
  }

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

  const updateData: Record<string, unknown> = { ...req.body, updatedAt: new Date() }

  if (req.body.hearingDate) {
    updateData.hearingDate = new Date(req.body.hearingDate)
  }
  if (req.body.nextHearingDate) {
    updateData.nextHearingDate = new Date(req.body.nextHearingDate)
  }

  const [updated] = await db
    .update(caseHearings)
    .set(updateData)
    .where(eq(caseHearings.id, hearingId))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Duruşma bulunamadı.' })
    return
  }

  try {
    const hearingContext = await getHearingCalendarContext(req.user!.userId, updated.id)
    if (hearingContext) {
      await syncHearingToGoogleCalendar({
        hearingId: hearingContext.id,
        hearingDate: hearingContext.hearingDate,
        result: hearingContext.result,
        notes: hearingContext.notes,
        courtRoom: hearingContext.courtRoom,
        judge: hearingContext.judge,
        caseTitle: hearingContext.caseTitle,
        caseNumber: hearingContext.caseNumber,
        courtName: hearingContext.courtName,
        clientName: hearingContext.clientName,
      })
    }
  } catch (error) {
    console.error('[GoogleCalendar] Hearing update sync failed', updated.id, error)
  }

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
    .delete(caseHearings)
    .where(eq(caseHearings.id, hearingId))
    .returning()

  if (!deleted) {
    res.status(404).json({ error: 'Duruşma bulunamadı.' })
    return
  }

  try {
    await deleteHearingFromGoogleCalendar(deleted.id)
  } catch (error) {
    console.error('[GoogleCalendar] Hearing delete sync failed', deleted.id, error)
  }

  res.json({ message: 'Duruşma silindi.' })
})

export default router
