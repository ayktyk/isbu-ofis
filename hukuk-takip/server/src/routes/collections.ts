import { Router } from 'express'
import { eq, and, desc, or, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { collections, cases, clients, mediationFiles } from '../db/schema.js'
import { validate } from '../middleware/validate.js'
import { authenticate } from '../middleware/auth.js'
import { createCollectionSchema, updateCollectionSchema } from '../../../shared/dist/index.js'
import {
  getOwnedCase,
  getOwnedClient,
  getOwnedCollection,
  getOwnedMediationFile,
} from '../utils/ownership.js'
import { getSingleValue } from '../utils/request.js'
import { logDiaryEntry } from '../utils/diaryLog.js'

const router = Router()
router.use(authenticate)

// ─── GET /api/collections ─────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const caseId = getSingleValue(req.query.caseId)
  const mediationFileId = getSingleValue(req.query.mediationFileId)
  const source = getSingleValue(req.query.source) // 'case' | 'mediation' | 'cmk'

  // Polimorfik owner check: collections.user_id direkt ya da case.user_id üzerinden
  const ownerCondition = or(
    eq(collections.userId, req.user!.userId),
    eq(cases.userId, req.user!.userId)
  )!

  const conditions = [
    ownerCondition,
    isNull(collections.archivedAt),
    or(isNull(collections.caseId), isNull(cases.archivedAt))!,
    or(isNull(collections.mediationFileId), isNull(mediationFiles.archivedAt))!,
  ]

  if (caseId) conditions.push(eq(collections.caseId, caseId))
  if (mediationFileId) conditions.push(eq(collections.mediationFileId, mediationFileId))
  if (source === 'case') conditions.push(isNull(collections.mediationFileId))
  if (source === 'mediation') conditions.push(isNull(collections.caseId))
  // CMK filtresi: yalnız CMK görevlendirmesi atanmış davalara bağlı tahsilatlar.
  // mediation tahsilatları zaten CMK olamayacağı için hariçtir.
  if (source === 'cmk') conditions.push(eq(cases.isCmkAssignment, true))

  const data = await db
    .select({
      id: collections.id,
      caseId: collections.caseId,
      mediationFileId: collections.mediationFileId,
      clientId: collections.clientId,
      userId: collections.userId,
      amount: collections.amount,
      currency: collections.currency,
      collectionDate: collections.collectionDate,
      description: collections.description,
      paymentMethod: collections.paymentMethod,
      receiptNo: collections.receiptNo,
      caseTitle: cases.title,
      caseNumber: cases.caseNumber,
      caseIsCmk: cases.isCmkAssignment,
      mediationFileNo: mediationFiles.fileNo,
      mediationDisputeType: mediationFiles.disputeType,
      clientName: clients.fullName,
      createdAt: collections.createdAt,
    })
    .from(collections)
    .leftJoin(cases, eq(collections.caseId, cases.id))
    .leftJoin(mediationFiles, eq(collections.mediationFileId, mediationFiles.id))
    .leftJoin(clients, eq(collections.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(desc(collections.createdAt))

  res.json(data)
})

// ─── POST /api/collections ───────────────────────────────────────────────────

router.post('/', validate(createCollectionSchema), async (req, res) => {
  const { caseId, mediationFileId, clientId } = req.body

  // XOR garantisi (schema refine zaten yapıyor ama defense in depth)
  if (!caseId === !mediationFileId) {
    res.status(400).json({ error: 'Tahsilat ya bir davaya ya da arabuluculuk dosyasına bağlı olmalı.' })
    return
  }

  if (caseId) {
    const ownedCase = await getOwnedCase(req.user!.userId, caseId)
    if (!ownedCase) {
      res.status(404).json({ error: 'Dava bulunamadi.' })
      return
    }
  }

  if (mediationFileId) {
    const ownedMediation = await getOwnedMediationFile(req.user!.userId, mediationFileId)
    if (!ownedMediation) {
      res.status(404).json({ error: 'Arabuluculuk dosyası bulunamadı.' })
      return
    }
  }

  if (clientId) {
    const ownedClient = await getOwnedClient(req.user!.userId, clientId)
    if (!ownedClient) {
      res.status(404).json({ error: 'Müvekkil bulunamadı.' })
      return
    }
  }

  const [collection] = await db
    .insert(collections)
    .values({
      ...req.body,
      userId: req.user!.userId,
    })
    .returning()

  // Dava bağlı tahsilatlarda günlüğe düş (arabuluculuk tahsilatları için günlük tutmuyoruz).
  if (collection.caseId) {
    void logDiaryEntry({
      caseId: collection.caseId,
      userId: req.user!.userId,
      entryType: 'collection_added',
      title: 'Tahsilat alındı',
      content: `${collection.amount} ${collection.currency || 'TRY'}${collection.description ? ` • ${collection.description}` : ''}`,
      linkedEntityType: 'collection',
      linkedEntityId: collection.id,
      occurredAt: collection.createdAt ?? new Date(),
    })
  }

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

  if (req.body.mediationFileId) {
    const ownedMediation = await getOwnedMediationFile(req.user!.userId, req.body.mediationFileId)
    if (!ownedMediation) {
      res.status(404).json({ error: 'Arabuluculuk dosyası bulunamadı.' })
      return
    }
  }

  if (req.body.clientId) {
    const ownedClient = await getOwnedClient(req.user!.userId, req.body.clientId)
    if (!ownedClient) {
      res.status(404).json({ error: 'Müvekkil bulunamadı.' })
      return
    }
  }

  const [updated] = await db
    .update(collections)
    .set(req.body)
    .where(and(eq(collections.id, collectionId), isNull(collections.archivedAt)))
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
    .update(collections)
    .set({ archivedAt: new Date() })
    .where(and(eq(collections.id, collectionId), isNull(collections.archivedAt)))
    .returning()

  if (!deleted) {
    res.status(404).json({ error: 'Tahsilat bulunamadı.' })
    return
  }

  res.json({ message: 'Tahsilat arşivlendi.' })
})

export default router
