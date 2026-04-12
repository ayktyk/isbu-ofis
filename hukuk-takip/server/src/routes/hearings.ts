import { Router } from 'express'
import { eq, and, gte, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { caseHearings, cases, clients } from '../db/schema.js'
import { validate } from '../middleware/validate.js'
import { authenticate } from '../middleware/auth.js'
import { createHearingSchema, updateHearingSchema } from '@hukuk-takip/shared'
import { getOwnedCase, getOwnedHearing } from '../utils/ownership.js'
import { getSingleValue } from '../utils/request.js'

const router = Router()
router.use(authenticate)

// ─── GET /api/hearings — Tüm duruşmalar (yaklaşan önce) ──────────────────────

router.get('/', async (req, res) => {
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

// ─── POST /api/hearings ───────────────────────────────────────────────────────

router.post('/', validate(createHearingSchema), async (req, res) => {
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

  res.status(201).json(hearing)
})

// ─── PUT /api/hearings/:id ────────────────────────────────────────────────────

router.put('/:id', validate(updateHearingSchema), async (req, res) => {
  const hearingId = getSingleValue(req.params.id)

  if (!hearingId) {
    res.status(400).json({ error: 'Gecersiz durusma id.' })
    return
  }

  const ownedHearing = await getOwnedHearing(req.user!.userId, hearingId)
  if (!ownedHearing) {
    res.status(404).json({ error: 'Durusma bulunamadi.' })
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

  res.json(updated)
})

// ─── DELETE /api/hearings/:id ─────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  const hearingId = getSingleValue(req.params.id)

  if (!hearingId) {
    res.status(400).json({ error: 'Gecersiz durusma id.' })
    return
  }

  const ownedHearing = await getOwnedHearing(req.user!.userId, hearingId)
  if (!ownedHearing) {
    res.status(404).json({ error: 'Durusma bulunamadi.' })
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

  res.json({ message: 'Duruşma silindi.' })
})

export default router
