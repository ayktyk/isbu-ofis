import { Router } from 'express'
import { eq, and, ilike, or, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, cases } from '../db/schema.js'
import { validate } from '../middleware/validate.js'
import { authenticate } from '../middleware/auth.js'
import { createClientSchema, updateClientSchema } from '@hukuk-takip/shared'
import { getPositiveInt, getSingleValue } from '../utils/request.js'

const router = Router()

// Tüm route'lar auth gerektirir
router.use(authenticate)

// ─── GET /api/clients — Müvekkil listesi ──────────────────────────────────────

router.get('/', async (req, res) => {
  const search = getSingleValue(req.query.search)
  const page = getPositiveInt(req.query.page, 1)
  const pageSize = getPositiveInt(req.query.pageSize, 20)
  const offset = (page - 1) * pageSize

  const conditions = [eq(clients.userId, req.user!.userId), eq(clients.isActive, true)]

  if (search?.trim()) {
    conditions.push(
      or(
        ilike(clients.fullName, `%${search.trim()}%`),
        ilike(clients.phone, `%${search.trim()}%`),
        ilike(clients.email, `%${search.trim()}%`)
      )!
    )
  }

  const where = and(...conditions)

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(where)
      .orderBy(desc(clients.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(where),
  ])

  const total = countResult[0]?.count ?? 0

  res.json({
    data,
    total,
    page,
    pageSize,
    hasMore: offset + data.length < total,
  })
})

// ─── GET /api/clients/:id — Müvekkil detayı ──────────────────────────────────

router.get('/:id', async (req, res) => {
  const clientId = getSingleValue(req.params.id)

  if (!clientId) {
    res.status(400).json({ error: 'Gecersiz muvekkil id.' })
    return
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, req.user!.userId)))
    .limit(1)

  if (!client) {
    res.status(404).json({ error: 'Müvekkil bulunamadı.' })
    return
  }

  res.json(client)
})

// ─── POST /api/clients — Yeni müvekkil ───────────────────────────────────────

router.post('/', validate(createClientSchema), async (req, res) => {
  const [client] = await db
    .insert(clients)
    .values({
      ...req.body,
      userId: req.user!.userId,
    })
    .returning()

  res.status(201).json(client)
})

// ─── PUT /api/clients/:id — Müvekkil güncelle ────────────────────────────────

router.put('/:id', validate(updateClientSchema), async (req, res) => {
  const clientId = getSingleValue(req.params.id)

  if (!clientId) {
    res.status(400).json({ error: 'Gecersiz muvekkil id.' })
    return
  }

  const [client] = await db
    .update(clients)
    .set({
      ...req.body,
      updatedAt: new Date(),
    })
    .where(and(eq(clients.id, clientId), eq(clients.userId, req.user!.userId)))
    .returning()

  if (!client) {
    res.status(404).json({ error: 'Müvekkil bulunamadı.' })
    return
  }

  res.json(client)
})

// ─── DELETE /api/clients/:id — Müvekkil sil (soft delete) ─────────────────────

router.delete('/:id', async (req, res) => {
  const clientId = getSingleValue(req.params.id)

  if (!clientId) {
    res.status(400).json({ error: 'Gecersiz muvekkil id.' })
    return
  }

  const [client] = await db
    .update(clients)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(clients.id, clientId), eq(clients.userId, req.user!.userId)))
    .returning()

  if (!client) {
    res.status(404).json({ error: 'Müvekkil bulunamadı.' })
    return
  }

  res.json({ message: 'Müvekkil silindi.' })
})

// ─── GET /api/clients/:id/cases — Müvekkilin davaları ────────────────────────

router.get('/:id/cases', async (req, res) => {
  const clientId = getSingleValue(req.params.id)

  if (!clientId) {
    res.status(400).json({ error: 'Gecersiz muvekkil id.' })
    return
  }

  const data = await db
    .select()
    .from(cases)
    .where(and(eq(cases.clientId, clientId), eq(cases.userId, req.user!.userId)))
    .orderBy(desc(cases.createdAt))

  res.json(data)
})

export default router
