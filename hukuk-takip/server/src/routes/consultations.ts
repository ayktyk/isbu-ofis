import { Router, type Request, type Response } from 'express'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, consultations } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  createConsultationSchema,
  updateConsultationSchema,
} from '../../../shared/dist/index.js'
import { getSingleValue } from '../utils/request.js'

const router = Router()
router.use(authenticate)

// ─── List with filters ──────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  const status = getSingleValue(req.query.status)
  const source = getSingleValue(req.query.source)
  const from = getSingleValue(req.query.from)
  const to = getSingleValue(req.query.to)

  const conditions = [eq(consultations.userId, req.user!.userId)]

  if (status) conditions.push(eq(consultations.status, status as any))
  if (source) conditions.push(eq(consultations.source, source as any))
  if (from) conditions.push(gte(consultations.consultationDate, new Date(from)))
  if (to) conditions.push(lte(consultations.consultationDate, new Date(to)))

  const data = await db
    .select({
      id: consultations.id,
      consultationDate: consultations.consultationDate,
      fullName: consultations.fullName,
      phone: consultations.phone,
      type: consultations.type,
      subject: consultations.subject,
      notes: consultations.notes,
      status: consultations.status,
      source: consultations.source,
      sourceDetail: consultations.sourceDetail,
      referredByClientId: consultations.referredByClientId,
      referredByClientName: clients.fullName,
      nextActionDate: consultations.nextActionDate,
      convertedClientId: consultations.convertedClientId,
      createdAt: consultations.createdAt,
    })
    .from(consultations)
    .leftJoin(clients, eq(consultations.referredByClientId, clients.id))
    .where(and(...conditions))
    .orderBy(desc(consultations.consultationDate))

  res.json(data)
})

// ─── Stats: weekly/monthly count + conversion rate ──────────────────────────

router.get('/stats', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const now = new Date()

  // Week start (Monday, Turkish convention)
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)

  // Month start
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Today
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const [todayCount, weekCount, monthCount, monthConverted, potentialCount] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(consultations)
      .where(
        and(
          eq(consultations.userId, userId),
          gte(consultations.consultationDate, todayStart),
          lte(consultations.consultationDate, todayEnd)
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(consultations)
      .where(
        and(
          eq(consultations.userId, userId),
          gte(consultations.consultationDate, weekStart)
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(consultations)
      .where(
        and(
          eq(consultations.userId, userId),
          gte(consultations.consultationDate, monthStart)
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(consultations)
      .where(
        and(
          eq(consultations.userId, userId),
          eq(consultations.status, 'converted'),
          gte(consultations.consultationDate, monthStart)
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(consultations)
      .where(
        and(
          eq(consultations.userId, userId),
          eq(consultations.status, 'potential')
        )
      ),
  ])

  const today = todayCount[0]?.count || 0
  const week = weekCount[0]?.count || 0
  const month = monthCount[0]?.count || 0
  const converted = monthConverted[0]?.count || 0
  const potential = potentialCount[0]?.count || 0
  const conversionRate = month > 0 ? Math.round((converted / month) * 100) : 0

  res.json({
    today,
    week,
    month,
    converted,
    potential,
    conversionRate,
    weeklyGoal: 5,
    monthlyGoal: 20,
    dailyGoal: 1,
  })
})

// ─── Create ─────────────────────────────────────────────────────────────────

router.post('/', validate(createConsultationSchema), async (req: Request, res: Response) => {
  const {
    consultationDate,
    nextActionDate,
    referredByClientId,
    source,
    sourceDetail,
    phone,
    subject,
    notes,
    ...rest
  } = req.body

  const [created] = await db
    .insert(consultations)
    .values({
      ...rest,
      userId: req.user!.userId,
      consultationDate: new Date(consultationDate),
      nextActionDate: nextActionDate || null,
      referredByClientId: referredByClientId || null,
      source: source || null,
      sourceDetail: sourceDetail || null,
      phone: phone || null,
      subject: subject || null,
      notes: notes || null,
    })
    .returning()

  res.status(201).json(created)
})

// ─── Update ─────────────────────────────────────────────────────────────────

router.put('/:id', validate(updateConsultationSchema), async (req: Request, res: Response) => {
  const id = getSingleValue(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'Geçersiz görüşme id.' })
    return
  }

  const updateData: Record<string, unknown> = { ...req.body, updatedAt: new Date() }
  if (req.body.consultationDate) updateData.consultationDate = new Date(req.body.consultationDate)
  if (req.body.nextActionDate === '') updateData.nextActionDate = null
  if (req.body.referredByClientId === '') updateData.referredByClientId = null
  if (req.body.source === '') updateData.source = null
  if (req.body.sourceDetail === '') updateData.sourceDetail = null

  const [updated] = await db
    .update(consultations)
    .set(updateData)
    .where(and(eq(consultations.id, id), eq(consultations.userId, req.user!.userId)))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Görüşme bulunamadı.' })
    return
  }

  res.json(updated)
})

// ─── Convert to client ──────────────────────────────────────────────────────

router.post('/:id/convert', async (req: Request, res: Response) => {
  const id = getSingleValue(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'Geçersiz görüşme id.' })
    return
  }

  const [consultation] = await db
    .select()
    .from(consultations)
    .where(and(eq(consultations.id, id), eq(consultations.userId, req.user!.userId)))
    .limit(1)

  if (!consultation) {
    res.status(404).json({ error: 'Görüşme bulunamadı.' })
    return
  }

  if (consultation.convertedClientId) {
    res.status(400).json({ error: 'Bu görüşme zaten müvekkile dönüştürüldü.' })
    return
  }

  // Create new client from consultation data
  const [newClient] = await db
    .insert(clients)
    .values({
      userId: req.user!.userId,
      fullName: consultation.fullName,
      phone: consultation.phone,
      notes: consultation.notes
        ? `Ön görüşmeden geldi. Konu: ${consultation.subject || '-'}\n\n${consultation.notes}`
        : `Ön görüşmeden geldi. Konu: ${consultation.subject || '-'}`,
    })
    .returning()

  // Mark consultation as converted
  await db
    .update(consultations)
    .set({
      status: 'converted',
      convertedClientId: newClient.id,
      updatedAt: new Date(),
    })
    .where(eq(consultations.id, id))

  res.json({ client: newClient, message: 'Müvekkil kaydı oluşturuldu.' })
})

// ─── Delete ─────────────────────────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response) => {
  const id = getSingleValue(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'Geçersiz görüşme id.' })
    return
  }

  const [deleted] = await db
    .delete(consultations)
    .where(and(eq(consultations.id, id), eq(consultations.userId, req.user!.userId)))
    .returning()

  if (!deleted) {
    res.status(404).json({ error: 'Görüşme bulunamadı.' })
    return
  }

  res.json({ message: 'Görüşme silindi.' })
})

export default router
