import { Router } from 'express'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { collections, cases, clients } from '../db/schema.js'
import { validate } from '../middleware/validate.js'
import { authenticate } from '../middleware/auth.js'
import { createCollectionSchema, updateCollectionSchema } from '@hukuk-takip/shared'
import { getOwnedCase, getOwnedClient, getOwnedCollection } from '../utils/ownership.js'
import { getSingleValue } from '../utils/request.js'

const router = Router()
router.use(authenticate)

// ─── GET /api/collections ─────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const caseId = getSingleValue(req.query.caseId)
  const conditions = [eq(cases.userId, req.user!.userId)]
  if (caseId) {
    conditions.push(eq(collections.caseId, caseId))
  }

  const data = await db
    .select({
      id: collections.id,
      caseId: collections.caseId,
      clientId: collections.clientId,
      amount: collections.amount,
      currency: collections.currency,
      collectionDate: collections.collectionDate,
      description: collections.description,
      paymentMethod: collections.paymentMethod,
      receiptNo: collections.receiptNo,
      caseTitle: cases.title,
      clientName: clients.fullName,
      createdAt: collections.createdAt,
    })
    .from(collections)
    .innerJoin(cases, eq(collections.caseId, cases.id))
    .leftJoin(clients, eq(collections.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(desc(collections.createdAt))

  res.json(data)
})

// ─── POST /api/collections ───────────────────────────────────────────────────

router.post('/', validate(createCollectionSchema), async (req, res) => {
  const ownedCase = await getOwnedCase(req.user!.userId, req.body.caseId)
  if (!ownedCase) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const ownedClient = await getOwnedClient(req.user!.userId, req.body.clientId)
  if (!ownedClient) {
    res.status(404).json({ error: 'Muvekkil bulunamadi.' })
    return
  }

  const [collection] = await db
    .insert(collections)
    .values(req.body)
    .returning()

  res.status(201).json(collection)
})

// ─── PUT /api/collections/:id ────────────────────────────────────────────────

router.put('/:id', validate(updateCollectionSchema), async (req, res) => {
  const collectionId = getSingleValue(req.params.id)

  if (!collectionId) {
    res.status(400).json({ error: 'Gecersiz tahsilat id.' })
    return
  }

  const ownedCollection = await getOwnedCollection(req.user!.userId, collectionId)
  if (!ownedCollection) {
    res.status(404).json({ error: 'Tahsilat bulunamadi.' })
    return
  }

  if (req.body.caseId) {
    const ownedCase = await getOwnedCase(req.user!.userId, req.body.caseId)
    if (!ownedCase) {
      res.status(404).json({ error: 'Dava bulunamadi.' })
      return
    }
  }

  if (req.body.clientId) {
    const ownedClient = await getOwnedClient(req.user!.userId, req.body.clientId)
    if (!ownedClient) {
      res.status(404).json({ error: 'Muvekkil bulunamadi.' })
      return
    }
  }

  const [updated] = await db
    .update(collections)
    .set(req.body)
    .where(eq(collections.id, collectionId))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Tahsilat bulunamadı.' })
    return
  }

  res.json(updated)
})

// ─── DELETE /api/collections/:id ─────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  const collectionId = getSingleValue(req.params.id)

  if (!collectionId) {
    res.status(400).json({ error: 'Gecersiz tahsilat id.' })
    return
  }

  const ownedCollection = await getOwnedCollection(req.user!.userId, collectionId)
  if (!ownedCollection) {
    res.status(404).json({ error: 'Tahsilat bulunamadi.' })
    return
  }

  const [deleted] = await db
    .delete(collections)
    .where(eq(collections.id, collectionId))
    .returning()

  if (!deleted) {
    res.status(404).json({ error: 'Tahsilat bulunamadı.' })
    return
  }

  res.json({ message: 'Tahsilat silindi.' })
})

export default router
