import { Router } from 'express'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { notifications } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { getSingleValue } from '../utils/request.js'

const router = Router()
router.use(authenticate)

// ─── GET /api/notifications ─────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const unread = getSingleValue(req.query.unread)

  const conditions = [eq(notifications.userId, req.user!.userId)]

  if (unread === 'true') {
    conditions.push(eq(notifications.isRead, false))
  }

  const data = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))

  res.json(data)
})

// ─── PATCH /api/notifications/read-all ──────────────────────────────────────

router.patch('/read-all', async (req, res) => {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.userId, req.user!.userId))

  res.json({ message: 'Tüm bildirimler okundu olarak işaretlendi.' })
})

// ─── PATCH /api/notifications/:id/read ──────────────────────────────────────

router.patch('/:id/read', async (req, res) => {
  const notificationId = getSingleValue(req.params.id)

  if (!notificationId) {
    res.status(400).json({ error: 'Gecersiz bildirim id.' })
    return
  }

  const [updated] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, req.user!.userId)
      )
    )
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Bildirim bulunamadı.' })
    return
  }

  res.json(updated)
})

// ─── DELETE /api/notifications/:id ──────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  const notificationId = getSingleValue(req.params.id)

  if (!notificationId) {
    res.status(400).json({ error: 'Gecersiz bildirim id.' })
    return
  }

  const [deleted] = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, req.user!.userId)
      )
    )
    .returning()

  if (!deleted) {
    res.status(404).json({ error: 'Bildirim bulunamadı.' })
    return
  }

  res.json({ message: 'Bildirim silindi.' })
})

export default router
