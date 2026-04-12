import { Router } from 'express'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { notes } from '../db/schema.js'
import { validate } from '../middleware/validate.js'
import { authenticate } from '../middleware/auth.js'
import { createNoteSchema, updateNoteSchema } from '@hukuk-takip/shared'
import { getOwnedCase, getOwnedClient } from '../utils/ownership.js'
import { getSingleValue } from '../utils/request.js'

const router = Router()
router.use(authenticate)

router.post('/', validate(createNoteSchema), async (req, res) => {
  const { caseId, clientId, content } = req.body

  if (caseId) {
    const ownedCase = await getOwnedCase(req.user!.userId, caseId)
    if (!ownedCase) {
      res.status(404).json({ error: 'Dava bulunamadi.' })
      return
    }
  }

  if (clientId) {
    const ownedClient = await getOwnedClient(req.user!.userId, clientId)
    if (!ownedClient) {
      res.status(404).json({ error: 'Muvekkil bulunamadi.' })
      return
    }
  }

  const [note] = await db
    .insert(notes)
    .values({
      caseId: caseId || null,
      clientId: clientId || null,
      userId: req.user!.userId,
      content,
    })
    .returning()

  res.status(201).json(note)
})

router.put('/:id', validate(updateNoteSchema), async (req, res) => {
  const noteId = getSingleValue(req.params.id)

  if (!noteId) {
    res.status(400).json({ error: 'Gecersiz not id.' })
    return
  }

  const [updated] = await db
    .update(notes)
    .set({ content: req.body.content, updatedAt: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.userId, req.user!.userId)))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Not bulunamadı.' })
    return
  }

  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  const noteId = getSingleValue(req.params.id)

  if (!noteId) {
    res.status(400).json({ error: 'Gecersiz not id.' })
    return
  }

  const [deleted] = await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, req.user!.userId)))
    .returning()

  if (!deleted) {
    res.status(404).json({ error: 'Not bulunamadı.' })
    return
  }

  res.json({ message: 'Not silindi.' })
})

export default router
