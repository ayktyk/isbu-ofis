import { Router, type Request, type Response } from 'express'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { collections, mediationFiles, mediationParties } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  createMediationFileSchema,
  updateMediationFileSchema,
} from '../../../shared/dist/index.js'
import { getOwnedMediationFile } from '../utils/ownership.js'
import { getSingleValue } from '../utils/request.js'

const router = Router()
router.use(authenticate)

// List all mediation files
router.get('/', async (req: Request, res: Response) => {
  const status = getSingleValue(req.query.status)
  const mediationType = getSingleValue(req.query.mediationType)

  const conditions = [eq(mediationFiles.userId, req.user!.userId)]

  if (status) {
    conditions.push(eq(mediationFiles.status, status as any))
  }
  if (mediationType) {
    conditions.push(eq(mediationFiles.mediationType, mediationType as any))
  }

  const files = await db
    .select()
    .from(mediationFiles)
    .where(and(...conditions))
    .orderBy(desc(mediationFiles.createdAt))

  // Fetch parties for each file
  const fileIds = files.map((f) => f.id)
  const allParties =
    fileIds.length > 0
      ? await db
          .select()
          .from(mediationParties)
          .where(
            fileIds.length === 1
              ? eq(mediationParties.mediationFileId, fileIds[0])
              : undefined as any // fallback below
          )
      : []

  // If more than one file, fetch all parties and group
  let partiesByFile: Record<string, typeof allParties> = {}
  if (fileIds.length > 1) {
    const allPartiesRaw = await db.select().from(mediationParties)
    for (const p of allPartiesRaw) {
      if (fileIds.includes(p.mediationFileId)) {
        if (!partiesByFile[p.mediationFileId]) partiesByFile[p.mediationFileId] = []
        partiesByFile[p.mediationFileId].push(p)
      }
    }
  } else if (fileIds.length === 1) {
    partiesByFile[fileIds[0]] = allParties
  }

  const result = files.map((f) => ({
    ...f,
    parties: partiesByFile[f.id] || [],
  }))

  res.json(result)
})

// Get single mediation file
router.get('/:id', async (req: Request, res: Response) => {
  const id = getSingleValue(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'Gecersiz id.' })
    return
  }

  const [file] = await db
    .select()
    .from(mediationFiles)
    .where(and(eq(mediationFiles.id, id), eq(mediationFiles.userId, req.user!.userId)))
    .limit(1)

  if (!file) {
    res.status(404).json({ error: 'Dosya bulunamadi.' })
    return
  }

  const parties = await db
    .select()
    .from(mediationParties)
    .where(eq(mediationParties.mediationFileId, id))

  res.json({ ...file, parties })
})

// Create mediation file
router.post('/', validate(createMediationFileSchema), async (req: Request, res: Response) => {
  const { parties, startDate, endDate, agreedFee, currency, ...rest } = req.body

  const [file] = await db
    .insert(mediationFiles)
    .values({
      ...rest,
      userId: req.user!.userId,
      startDate: startDate || null,
      endDate: endDate || null,
      agreedFee: agreedFee && agreedFee !== '' ? agreedFee : null,
      currency: currency || 'TRY',
    })
    .returning()

  if (parties?.length) {
    await db.insert(mediationParties).values(
      parties.map((p: any) => ({
        mediationFileId: file.id,
        side: p.side,
        fullName: p.fullName,
        tcNo: p.tcNo || null,
        phone: p.phone || null,
        email: p.email || null,
        address: p.address || null,
        lawyerName: p.lawyerName || null,
        lawyerBarNo: p.lawyerBarNo || null,
        lawyerPhone: p.lawyerPhone || null,
      }))
    )
  }

  const createdParties = await db
    .select()
    .from(mediationParties)
    .where(eq(mediationParties.mediationFileId, file.id))

  res.status(201).json({ ...file, parties: createdParties })
})

// Update mediation file
router.put('/:id', validate(updateMediationFileSchema), async (req: Request, res: Response) => {
  const id = getSingleValue(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'Gecersiz id.' })
    return
  }

  const { parties, startDate, endDate, agreedFee, currency, ...rest } = req.body

  const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() }
  if (startDate !== undefined) updateData.startDate = startDate || null
  if (endDate !== undefined) updateData.endDate = endDate || null
  if (agreedFee !== undefined) updateData.agreedFee = agreedFee && agreedFee !== '' ? agreedFee : null
  if (currency !== undefined) updateData.currency = currency || 'TRY'

  const [updated] = await db
    .update(mediationFiles)
    .set(updateData)
    .where(and(eq(mediationFiles.id, id), eq(mediationFiles.userId, req.user!.userId)))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Dosya bulunamadi.' })
    return
  }

  // Replace parties if provided
  if (parties) {
    await db.delete(mediationParties).where(eq(mediationParties.mediationFileId, id))

    if (parties.length) {
      await db.insert(mediationParties).values(
        parties.map((p: any) => ({
          mediationFileId: id,
          side: p.side,
          fullName: p.fullName,
          tcNo: p.tcNo || null,
          phone: p.phone || null,
          email: p.email || null,
          address: p.address || null,
          lawyerName: p.lawyerName || null,
          lawyerBarNo: p.lawyerBarNo || null,
          lawyerPhone: p.lawyerPhone || null,
        }))
      )
    }
  }

  const updatedParties = await db
    .select()
    .from(mediationParties)
    .where(eq(mediationParties.mediationFileId, id))

  res.json({ ...updated, parties: updatedParties })
})

// List collections for a mediation file
router.get('/:id/collections', async (req: Request, res: Response) => {
  const id = getSingleValue(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'Gecersiz id.' })
    return
  }

  const owned = await getOwnedMediationFile(req.user!.userId, id)
  if (!owned) {
    res.status(404).json({ error: 'Dosya bulunamadi.' })
    return
  }

  const data = await db
    .select()
    .from(collections)
    .where(eq(collections.mediationFileId, id))
    .orderBy(desc(collections.createdAt))

  res.json(data)
})

// Delete mediation file
router.delete('/:id', async (req: Request, res: Response) => {
  const id = getSingleValue(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'Gecersiz id.' })
    return
  }

  const [deleted] = await db
    .delete(mediationFiles)
    .where(and(eq(mediationFiles.id, id), eq(mediationFiles.userId, req.user!.userId)))
    .returning()

  if (!deleted) {
    res.status(404).json({ error: 'Dosya bulunamadi.' })
    return
  }

  res.json({ message: 'Arabuluculuk dosyasi silindi.' })
})

export default router
