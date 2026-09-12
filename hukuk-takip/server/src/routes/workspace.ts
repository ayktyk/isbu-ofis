import { Router } from 'express'
import { createHash } from 'node:crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { workflowSchema, hearingReviewSchema } from '@hukuk-takip/shared'
import { db } from '../db/index.js'
import { cases, caseWorkspaces, users, caseHearings, caseDiaryEntries, tasks, hearingReviewReceipts } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(authenticate)
router.param('id', (req, res, next, id) => { if (!z.string().uuid().safeParse(id).success) { res.status(400).json({ error: 'Geçersiz kayıt kimliği.' }); return } next() })
const finished = ['won', 'lost', 'settled', 'closed']
async function writable(tx: any, userId: string, caseId: string) {
  const [owner] = await tx.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.userId, userId), isNull(cases.archivedAt))).for('update')
  const [user] = await tx.select().from(users).where(eq(users.id, userId))
  if (!owner) throw Object.assign(new Error('Dava bulunamadı.'), { status: 404 })
  if (!['admin', 'lawyer'].includes(user?.role) || finished.includes(owner.status)) throw Object.assign(new Error('Bu dosyada düzenleme yetkiniz yok.'), { status: 403 })
  return owner
}
router.get('/:id/workflow', async (req, res) => {
  const id = z.string().uuid().parse(req.params.id)
  const [owner] = await db.select({ id: cases.id }).from(cases).where(and(eq(cases.id, id), eq(cases.userId, req.user!.userId), isNull(cases.archivedAt)))
  if (!owner) { res.status(404).json({ error: 'Dava bulunamadı.' }); return }
  const [row] = await db.select().from(caseWorkspaces).where(eq(caseWorkspaces.caseId, id))
  res.json(row || { stage: '', waitingFor: '', checkDate: null, revision: 0 })
})
router.put('/:id/workflow', validate(workflowSchema), async (req, res) => {
  const id = z.string().uuid().parse(req.params.id)
  const data = workflowSchema.parse(req.body)
  const result = await db.transaction(async tx => {
    await writable(tx, req.user!.userId, id)
    const [old] = await tx.select().from(caseWorkspaces).where(eq(caseWorkspaces.caseId, id))
    if ((old?.revision || 0) !== data.revision) throw Object.assign(new Error('Dosya başka bir ekranda güncellendi. Yenileyip tekrar deneyin.'), { status: 409 })
    const values = { ...data, revision: data.revision + 1, updatedAt: new Date() }
    const [row] = old ? await tx.update(caseWorkspaces).set(values).where(eq(caseWorkspaces.caseId, id)).returning() : await tx.insert(caseWorkspaces).values({ ...values, caseId: id }).returning()
    await tx.insert(caseDiaryEntries).values({ caseId: id, userId: req.user!.userId, entryType: 'manual', title: 'Çalışma planı güncellendi', content: `Aşama: ${data.stage || 'Belirtilmedi'}\nBeklenen: ${data.waitingFor || 'Yok'}\nKontrol: ${data.checkDate || 'Belirtilmedi'}` })
    return row
  })
  res.json(result)
})
router.post('/hearings/:id/review', validate(hearingReviewSchema), async (req, res) => {
  const id = z.string().uuid().parse(req.params.id)
  const input = hearingReviewSchema.parse(req.body)
  const payloadHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  const result = await db.transaction(async tx => {
    // Lock the parent first, then hearing, consistently with workflow updates.
    const [candidate] = await tx.select({ caseId: caseHearings.caseId }).from(caseHearings).where(and(eq(caseHearings.id, id), isNull(caseHearings.archivedAt)))
    if (!candidate) throw Object.assign(new Error('Duruşma bulunamadı.'), { status: 404 })
    await writable(tx, req.user!.userId, candidate.caseId)
    const [hearing] = await tx.select().from(caseHearings).where(and(eq(caseHearings.id, id), isNull(caseHearings.archivedAt))).for('update')
    if (!hearing || hearing.caseId !== candidate.caseId) throw Object.assign(new Error('Duruşma değişti, yenileyin.'), { status: 409 })
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.requestId}, 0))`)
    const [existing] = await tx.select().from(hearingReviewReceipts).where(eq(hearingReviewReceipts.requestId, input.requestId))
    if (existing) {
      if (existing.hearingId !== id || existing.payloadHash !== payloadHash) throw Object.assign(new Error('Bu kayıt isteği farklı içerikle kullanılmış. Önce duruşma kaydını kontrol edin.'), { status: 409 })
      return { saved: true, repeated: true }
    }
    if (hearing.result !== 'pending') throw Object.assign(new Error('Bu duruşmanın sonucu zaten kaydedilmiş.'), { status: 409 })
    if (input.nextDate && new Date(input.nextDate) <= hearing.hearingDate) throw Object.assign(new Error('Sonraki duruşma mevcut duruşmadan sonra olmalı.'), { status: 400 })
    await tx.update(caseHearings).set({ result: input.result, nextHearingDate: input.nextDate ? new Date(input.nextDate) : null, updatedAt: new Date() }).where(eq(caseHearings.id, id))
    if (input.nextDate) await tx.insert(caseHearings).values({ caseId: hearing.caseId, hearingDate: new Date(input.nextDate), courtRoom: hearing.courtRoom })
    if (input.tasks.length) await tx.insert(tasks).values(input.tasks.map(task => ({ caseId: hearing.caseId, userId: req.user!.userId, title: task.title, dueDate: task.dueDate ? new Date(task.dueDate) : null })))
    await tx.insert(caseDiaryEntries).values({ caseId: hearing.caseId, userId: req.user!.userId, entryType: 'hearing_completed', title: 'Duruşma sonrası kayıt', content: input.note, linkedEntityType: 'hearing_review', linkedEntityId: input.requestId })
    await tx.insert(hearingReviewReceipts).values({ requestId: input.requestId, hearingId: id, payloadHash })
    return { saved: true, repeated: false }
  })
  res.json(result)
})
export default router
