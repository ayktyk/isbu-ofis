import { Router, type Request, type Response } from 'express'
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { cases, notifications, tasks } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  createTaskSchema,
  updateTaskSchema,
  reorderTasksSchema,
  previewDeadlineSchema,
  LEGAL_DEADLINE_TEMPLATES,
  findTemplate,
  computeLegalDeadline,
} from '../../../shared/dist/index.js'
import { getOwnedCase } from '../utils/ownership.js'
import { getPositiveInt, getSingleValue } from '../utils/request.js'
import { syncTaskToGoogleCalendar } from '../utils/googleCalendar.js'
import { logDiaryEntry } from '../utils/diaryLog.js'

const router = Router()
router.use(authenticate)

async function getTaskCaseTitle(userId: string, caseId?: string | null) {
  if (!caseId) {
    return null
  }

  const [caseRow] = await db
    .select({ title: cases.title })
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.userId, userId), isNull(cases.archivedAt)))
    .limit(1)

  return caseRow?.title || null
}

// Görev listesi sırası — üstten alta üç grup:
//   0) Açık görevlerden süreli olanlar (son tarihi var) veya acil olanlar
//   1) Diğer açık görevler
//   2) Tamamlanan / iptal edilen görevler (en aşağı)
// Grup içinde: manuel sıra (sürükle-bırak) önce, sonra en yeni üstte.
// Not: enum değerleri şablon içine düz SQL literal'i olarak yazılır (${...}
// interpolasyonu bind parametresi üretir ve enum karşılaştırmasını zorlaştırır).
const taskGroupRank = sql`
  CASE
    WHEN ${tasks.status} IN ('completed', 'cancelled') THEN 2
    WHEN ${tasks.dueDate} IS NOT NULL OR ${tasks.priority} = 'urgent' THEN 0
    ELSE 1
  END
`

// Hiç sürüklenmemiş görevlerde sort_order NULL'dur; NULLS LAST ile grubun
// sonuna düşer ve kendi içinde en yeni üstte kalır. Yeni eklenen görevler
// POST / içinde negatif bir sort_order alır, böylece grubunun tepesine çıkar.
const taskListOrderBy = [
  sql`${taskGroupRank} ASC`,
  sql`${tasks.sortOrder} ASC NULLS LAST`,
  desc(tasks.createdAt),
]

const taskSelectColumns = {
  id: tasks.id,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  completedAt: tasks.completedAt,
  caseId: tasks.caseId,
  label: tasks.label,
  category: tasks.category,
  sortOrder: tasks.sortOrder,
  caseTitle: cases.title,
  // Eski (kategorisiz) görevlerin rozeti bağlı davadan türetilir; bunun için
  // davanın CMK olup olmadığı gerekir.
  caseIsCmk: cases.isCmkAssignment,
  createdAt: tasks.createdAt,
  // Süreli iş alanları
  isDeadline: tasks.isDeadline,
  deadlineTemplateKey: tasks.deadlineTemplateKey,
  deadlineCategory: tasks.deadlineCategory,
  deadlineSeverity: tasks.deadlineSeverity,
  triggerEventDate: tasks.triggerEventDate,
  triggerEventLabel: tasks.triggerEventLabel,
  calculatedDueDate: tasks.calculatedDueDate,
  adjustedForHoliday: tasks.adjustedForHoliday,
  legalBasis: tasks.legalBasis,
  completionEvidence: tasks.completionEvidence,
}

function parseBoolFlag(value: unknown): boolean | null {
  const v = getSingleValue(value)
  if (v === undefined || v === null || v === '') return null
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return null
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10))
  return new Date(year, (month || 1) - 1, day || 1)
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ---------- Süreli iş yardımcı endpoint'leri (önce gelir, /:id ile çakışmaması için) ----------

router.get('/deadlines/templates', (_req: Request, res: Response) => {
  // Statik liste — kullanıcıya ve oturuma bağlı değil, tüm istemcilerde aynı.
  // 24 saat immutable cache (deploy ile değişirse versiyonlu URL gerekir, şu an
  // shared/dist import'undan geldiği için release ile değişir → bundle hash yenilenir).
  res.set('Cache-Control', 'public, max-age=86400, immutable')
  res.json(LEGAL_DEADLINE_TEMPLATES)
})

router.post(
  '/deadlines/preview',
  validate(previewDeadlineSchema),
  (req: Request, res: Response) => {
    const { templateKey, triggerEventDate } = req.body as {
      templateKey: string
      triggerEventDate: string
    }
    const tpl = findTemplate(templateKey)
    if (!tpl) {
      res.status(400).json({ error: 'Süre şablonu bulunamadı.' })
      return
    }
    const trigger = parseDateInput(triggerEventDate)
    if (Number.isNaN(trigger.getTime())) {
      res.status(400).json({ error: 'Geçersiz tetikleyici tarih.' })
      return
    }
    const result = computeLegalDeadline(tpl, trigger)
    res.json({
      template: tpl,
      rawDueDate: formatDateOnly(result.rawDueDate),
      adjustedDueDate: formatDateOnly(result.adjustedDueDate),
      wasShifted: result.wasShifted,
    })
  }
)

router.get('/deadlines/critical', async (req: Request, res: Response) => {
  const withinDaysRaw = Number.parseInt(getSingleValue(req.query.withinDays) || '7', 10)
  const withinDays = Number.isFinite(withinDaysRaw) ? Math.min(Math.max(withinDaysRaw, 1), 365) : 7

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + withinDays)

  const rows = await db
    .select(taskSelectColumns)
    .from(tasks)
    .leftJoin(cases, eq(tasks.caseId, cases.id))
    .where(
      and(
        eq(tasks.userId, req.user!.userId),
        eq(tasks.isDeadline, true),
        isNull(tasks.archivedAt),
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, start),
        lte(tasks.dueDate, end),
        inArray(tasks.status, ['pending', 'in_progress'])
      )
    )
    .orderBy(asc(tasks.dueDate))

  res.json(rows)
})

// ---------- Genel görev endpoint'leri ----------

router.get('/', async (req: Request, res: Response) => {
  const status = getSingleValue(req.query.status)
  const priority = getSingleValue(req.query.priority)
  const category = getSingleValue(req.query.category)
  const severity = getSingleValue(req.query.severity)
  const isDeadlineFilter = parseBoolFlag(req.query.isDeadline)
  const dueWithinRaw = getSingleValue(req.query.dueWithinDays)
  const dueWithinDays =
    dueWithinRaw !== undefined && dueWithinRaw !== null && dueWithinRaw !== ''
      ? Number.parseInt(dueWithinRaw, 10)
      : null

  // Opt-in pagination: page veya pageSize verilirse {data,total,page,pageSize,hasMore}
  // formatında döner. Hiçbiri verilmezse eski davranış (düz array) korunur — CalendarPage
  // gibi parametresiz çağıran tüketiciler bozulmadan çalışmaya devam eder.
  const paginated = req.query.page !== undefined || req.query.pageSize !== undefined
  const page = paginated ? getPositiveInt(req.query.page, 1) : 1
  const pageSize = paginated ? Math.min(getPositiveInt(req.query.pageSize, 50), 200) : 0

  const conditions = [eq(tasks.userId, req.user!.userId), isNull(tasks.archivedAt)]

  if (status) {
    conditions.push(eq(tasks.status, status as any))
  }
  if (priority) {
    conditions.push(eq(tasks.priority, priority as any))
  }
  if (isDeadlineFilter !== null) {
    conditions.push(eq(tasks.isDeadline, isDeadlineFilter))
  }
  if (category) {
    conditions.push(eq(tasks.deadlineCategory, category))
  }
  if (severity) {
    conditions.push(eq(tasks.deadlineSeverity, severity))
  }
  if (dueWithinDays !== null && Number.isFinite(dueWithinDays) && dueWithinDays > 0) {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(start)
    end.setDate(end.getDate() + dueWithinDays)
    conditions.push(isNotNull(tasks.dueDate))
    conditions.push(gte(tasks.dueDate, start))
    conditions.push(lte(tasks.dueDate, end))
  }

  const where = and(...conditions)

  if (!paginated) {
    const data = await db
      .select(taskSelectColumns)
      .from(tasks)
      .leftJoin(cases, eq(tasks.caseId, cases.id))
      .where(where)
      .orderBy(...taskListOrderBy)
    res.json(data)
    return
  }

  const offset = (page - 1) * pageSize
  const [data, countResult] = await Promise.all([
    db
      .select(taskSelectColumns)
      .from(tasks)
      .leftJoin(cases, eq(tasks.caseId, cases.id))
      .where(where)
      .orderBy(...taskListOrderBy)
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(tasks).where(where),
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

// ---------- PATCH /api/tasks/reorder — sürükle-bırak sıralama ----------
// '/:id' iceren route'lardan ONCE tanimli olmali, aksi halde 'reorder' bir id
// gibi yorumlanir.
//
// Istemci ekranda gorunen SIRAYI id listesi olarak gonderir; sunucu 0..n-1
// atar. Yalnizca kullaniciya ait, arsivlenmemis gorevler guncellenir —
// baskasinin gorevi id listesine konsa bile dokunulmaz.
//
// Veri koruma: sadece sort_order kolonu yazilir; hicbir satir silinmez.
router.patch('/reorder', validate(reorderTasksSchema), async (req: Request, res: Response) => {
  const { ids } = req.body as { ids: string[] }
  const userId = req.user!.userId

  // Sahiplik dogrulamasi: gonderilen id'lerden gercekten bu kullaniciya ait
  // olanlari sec. Digerleri sessizce yok sayilir.
  const owned = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNull(tasks.archivedAt), inArray(tasks.id, ids)))

  const ownedSet = new Set(owned.map((row) => row.id))
  const orderedOwnedIds = ids.filter((id) => ownedSet.has(id))

  if (orderedOwnedIds.length === 0) {
    res.json({ updated: 0 })
    return
  }

  // Tek UPDATE + CASE WHEN: satir basina ayri sorgu atmak yerine tek turda
  // yazilir (500 gorevde 500 round-trip olmasin).
  const cases_ = orderedOwnedIds
    .map((id, index) => sql`WHEN ${id}::uuid THEN ${index}`)
    .reduce((acc, part) => sql`${acc} ${part}`)

  await db
    .update(tasks)
    .set({
      sortOrder: sql`CASE ${tasks.id} ${cases_} ELSE ${tasks.sortOrder} END`,
      updatedAt: new Date(),
    })
    .where(
      and(eq(tasks.userId, userId), isNull(tasks.archivedAt), inArray(tasks.id, orderedOwnedIds)),
    )

  res.json({ updated: orderedOwnedIds.length })
})

router.post('/', validate(createTaskSchema), async (req: Request, res: Response) => {
  const {
    dueDate,
    caseId,
    label,
    category,
    triggerEventDate,
    calculatedDueDate,
    isDeadline,
    deadlineTemplateKey,
    deadlineCategory,
    deadlineSeverity,
    triggerEventLabel,
    adjustedForHoliday,
    legalBasis,
    ...rest
  } = req.body

  if (caseId) {
    const ownedCase = await getOwnedCase(req.user!.userId, caseId)
    if (!ownedCase) {
      res.status(404).json({ error: 'Dava bulunamadi.' })
      return
    }
  }

  // Yeni görev kendi grubunun en üstünde görünsün: mevcut en küçük sıra
  // değerinin bir altı verilir. Hiç sıralama yapılmamışsa -1 olur ve
  // NULLS LAST sayesinde sıralanmamış görevlerin üstüne çıkar.
  const [minSortRow] = await db
    .select({ min: sql<number | null>`min(${tasks.sortOrder})` })
    .from(tasks)
    .where(and(eq(tasks.userId, req.user!.userId), isNull(tasks.archivedAt)))

  const nextSortOrder = Number(minSortRow?.min ?? 0) - 1

  const [task] = await db
    .insert(tasks)
    .values({
      ...rest,
      sortOrder: nextSortOrder,
      userId: req.user!.userId,
      caseId: caseId || null,
      label: label || null,
      category: category || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      isDeadline: isDeadline === true,
      deadlineTemplateKey: deadlineTemplateKey || null,
      deadlineCategory: deadlineCategory || null,
      deadlineSeverity: deadlineSeverity || null,
      triggerEventDate: triggerEventDate || null,
      triggerEventLabel: triggerEventLabel || null,
      calculatedDueDate: calculatedDueDate || null,
      adjustedForHoliday: adjustedForHoliday === true,
      legalBasis: legalBasis || null,
    })
    .returning()

  try {
    await syncTaskToGoogleCalendar({
      taskId: task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      label: task.label,
      status: task.status,
      caseTitle: await getTaskCaseTitle(req.user!.userId, task.caseId),
    })
  } catch (error) {
    console.error('[GoogleCalendar] Task create sync failed', task.id, error)
  }

  if (task.caseId) {
    void logDiaryEntry({
      caseId: task.caseId,
      userId: req.user!.userId,
      entryType: 'task_added',
      title: 'Görev eklendi',
      content: task.title,
      linkedEntityType: 'task',
      linkedEntityId: task.id,
      occurredAt: task.createdAt ?? new Date(),
    })
  }

  res.status(201).json(task)
})

router.put('/:id', validate(updateTaskSchema), async (req: Request, res: Response) => {
  const taskId = getSingleValue(req.params.id)

  if (!taskId) {
    res.status(400).json({ error: 'Gecersiz gorev id.' })
    return
  }

  if (req.body.caseId) {
    const ownedCase = await getOwnedCase(req.user!.userId, req.body.caseId)
    if (!ownedCase) {
      res.status(404).json({ error: 'Dava bulunamadi.' })
      return
    }
  }

  const {
    dueDate,
    caseId,
    label,
    category,
    triggerEventDate,
    calculatedDueDate,
    completionEvidence,
    ...rest
  } = req.body
  const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() }

  if ('caseId' in req.body) updateData.caseId = caseId || null
  if ('label' in req.body) updateData.label = label || null
  if ('category' in req.body) updateData.category = category || null
  if ('dueDate' in req.body) updateData.dueDate = dueDate ? new Date(dueDate) : null
  if ('triggerEventDate' in req.body) updateData.triggerEventDate = triggerEventDate || null
  if ('calculatedDueDate' in req.body) updateData.calculatedDueDate = calculatedDueDate || null
  if ('completionEvidence' in req.body) updateData.completionEvidence = completionEvidence || null
  if (req.body.status === 'completed') updateData.completedAt = new Date()
  if (req.body.status && req.body.status !== 'completed') updateData.completedAt = null

  const [updated] = await db
    .update(tasks)
    .set(updateData)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.userId), isNull(tasks.archivedAt)))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Görev bulunamadı.' })
    return
  }

  try {
    await syncTaskToGoogleCalendar({
      taskId: updated.id,
      title: updated.title,
      description: updated.description,
      dueDate: updated.dueDate,
      label: updated.label,
      status: updated.status,
      caseTitle: await getTaskCaseTitle(req.user!.userId, updated.caseId),
    })
  } catch (error) {
    console.error('[GoogleCalendar] Task update sync failed', updated.id, error)
  }

  res.json(updated)
})

router.patch('/:id/status', async (req: Request, res: Response) => {
  const taskId = getSingleValue(req.params.id)

  if (!taskId) {
    res.status(400).json({ error: 'Gecersiz gorev id.' })
    return
  }

  const { status, completionEvidence } = req.body as {
    status?: string
    completionEvidence?: string
  }
  const trimmedCompletionEvidence =
    typeof completionEvidence === 'string' ? completionEvidence.trim() : undefined

  // Süreli iş tamamlanırken kanıt notu zorunlu
  if (status === 'completed') {
    const [existing] = await db
      .select({ isDeadline: tasks.isDeadline })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.userId), isNull(tasks.archivedAt)))
      .limit(1)
    if (existing?.isDeadline) {
      if (!trimmedCompletionEvidence || trimmedCompletionEvidence.length < 5) {
        res.status(400).json({
          error: 'Süreli iş tamamlanırken en az 5 karakterlik kanıt notu zorunludur.',
          field: 'completionEvidence',
        })
        return
      }
    }
  }

  if (!status || !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    res.status(400).json({ error: 'Geçersiz görev durumu.' })
    return
  }

  const updateData: Record<string, unknown> = { status, updatedAt: new Date() }
  if (status === 'completed') updateData.completedAt = new Date()
  if (status && status !== 'completed') updateData.completedAt = null
  if (completionEvidence !== undefined) updateData.completionEvidence = trimmedCompletionEvidence || null

  const [updated] = await db
    .update(tasks)
    .set(updateData)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.userId), isNull(tasks.archivedAt)))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Görev bulunamadı.' })
    return
  }

  // Süreli iş tamamlandı/iptal edildi — bu task için üretilmiş eski "legal_deadline_critical"
  // bildirimleri soft-delete et (dismissed_at). Veri silinmez, sadece kullanıcı arayüzünde
  // gözükmez. Bell badge'i ve bildirimler sayfası "X gün kaldı" gibi eski uyarıları
  // göstermesin diye gerekli.
  if (updated.isDeadline && (status === 'completed' || status === 'cancelled')) {
    try {
      await db
        .update(notifications)
        .set({ dismissedAt: new Date(), isRead: true })
        .where(
          and(
            eq(notifications.userId, req.user!.userId),
            eq(notifications.type, 'legal_deadline_critical'),
            eq(notifications.relatedId, updated.id),
            isNull(notifications.dismissedAt)
          )
        )
    } catch (error) {
      console.error('[Notifications] Deadline tamamlandığında bildirim dismiss başarısız:', error)
    }
  }

  try {
    await syncTaskToGoogleCalendar({
      taskId: updated.id,
      title: updated.title,
      description: updated.description,
      dueDate: updated.dueDate,
      label: updated.label,
      status: updated.status,
      caseTitle: await getTaskCaseTitle(req.user!.userId, updated.caseId),
    })
  } catch (error) {
    console.error('[GoogleCalendar] Task status sync failed', updated.id, error)
  }

  if (status === 'completed' && updated.caseId) {
    void logDiaryEntry({
      caseId: updated.caseId,
      userId: req.user!.userId,
      entryType: 'task_completed',
      title: 'Görev tamamlandı',
      content: updated.title,
      linkedEntityType: 'task',
      linkedEntityId: updated.id,
      occurredAt: updated.completedAt ?? new Date(),
    })
  }

  res.json(updated)
})

router.delete('/:id', async (req: Request, res: Response) => {
  const taskId = getSingleValue(req.params.id)

  if (!taskId) {
    res.status(400).json({ error: 'Gecersiz gorev id.' })
    return
  }

  const [deleted] = await db
    .update(tasks)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, req.user!.userId), isNull(tasks.archivedAt)))
    .returning()

  if (!deleted) {
    res.status(404).json({ error: 'Görev bulunamadı.' })
    return
  }
  res.json({ message: 'Görev arşivlendi.' })
})

export default router
