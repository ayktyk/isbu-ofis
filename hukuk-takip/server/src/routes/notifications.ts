import { Router } from 'express'
import { eq, and, desc, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { notifications } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { getSingleValue } from '../utils/request.js'
import {
  ensureRecentReminderScan,
  getLastReminderScanAt,
} from '../services/notificationScheduler.js'

const router = Router()
router.use(authenticate)

// ─── GET /api/notifications ─────────────────────────────────────────────────
// Render Free cron garantili değil — her istekte 10 dk cooldown'lı scan
// tetikleyip DB'yi güncel tutarız. İlk istek bekler (yeni bildirimleri görsün),
// cooldown içindeyse skip.

router.get('/', async (req, res) => {
  const unread = getSingleValue(req.query.unread)

  // Fresh scan gerekirse çalıştır. Cooldown içindeyse null döner, skip.
  // Scan başarısız olursa bildirim listesi yine döner (scan tek başına fatal değil).
  try {
    const scan = ensureRecentReminderScan(false)
    if (scan) await scan
  } catch (err) {
    // Loglandı, devam
  }

  const conditions = [
    eq(notifications.userId, req.user!.userId),
    // Soft-delete: kullanicinin "sildigi" bildirimler listede gozukmez,
    // ama DB'de saklidir — scanner tekrar uretmez (mevcut kayit var sayar).
    isNull(notifications.dismissedAt),
  ]

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

// ─── POST /api/notifications/scan ────────────────────────────────────────────
// Manuel tarama tetikleyici. force=1 ile cooldown ezilebilir.
// Client "şimdi kontrol et" butonu veya dashboard açılışı bunu kullanır.

router.post('/scan', async (req, res) => {
  const force = getSingleValue(req.query.force) === '1'
  const scan = ensureRecentReminderScan(force)

  if (!scan) {
    res.json({
      skipped: true,
      lastScanAt: getLastReminderScanAt(),
      message: 'Son tarama yakın zamandaydı, atlandı.',
    })
    return
  }

  try {
    const result = await scan
    res.json({ skipped: false, result, lastScanAt: getLastReminderScanAt() })
  } catch (err) {
    res.status(500).json({ error: 'Tarama başarısız', details: String(err) })
  }
})

// ─── PATCH /api/notifications/read-all ──────────────────────────────────────

router.patch('/read-all', async (req, res) => {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.userId, req.user!.userId),
        isNull(notifications.dismissedAt)
      )
    )

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
// Soft-delete: satir silinmez, dismissed_at set edilir. Boylece:
//   1) Scanner duplicate kontrolunde bu kaydi gorur, yenisini UPRETMEZ
//      (eski davranis silince bildirim geri geliyordu — duzeltildi)
//   2) Veri kaybi olmaz, gecmise donuk denetim mumkun.

router.delete('/:id', async (req, res) => {
  const notificationId = getSingleValue(req.params.id)

  if (!notificationId) {
    res.status(400).json({ error: 'Gecersiz bildirim id.' })
    return
  }

  const [updated] = await db
    .update(notifications)
    .set({ dismissedAt: new Date(), isRead: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, req.user!.userId),
        isNull(notifications.dismissedAt)
      )
    )
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Bildirim bulunamadı.' })
    return
  }

  res.json({ message: 'Bildirim silindi.' })
})

export default router
