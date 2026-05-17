import { Router } from 'express'
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { createCaseSchema, updateCaseSchema } from '../../../shared/dist/index.js'
import { db } from '../db/index.js'
import {
  caseHearings,
  cases,
  clients,
  collections,
  documents,
  expenses,
  notes,
  tasks,
} from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { getOwnedCase } from '../utils/ownership.js'
import { getPositiveInt, getSingleValue } from '../utils/request.js'
import { logDiaryEntry } from '../utils/diaryLog.js'

const CASE_STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  istinafta: 'İstinafta',
  yargıtayda: 'Yargıtayda',
  passive: 'Pasif',
  closed: 'Kapatıldı',
  won: 'Kazanıldı',
  lost: 'Kaybedildi',
  settled: 'Uzlaşıldı',
}

const router = Router()
router.use(authenticate)

function normalizeNullableString(value: unknown) {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function normalizeCasePayload(payload: any): any {
  const normalized: any = {
    ...payload,
    startDate: normalizeNullableString(payload.startDate),
    closeDate: normalizeNullableString(payload.closeDate),
    contractedFee: normalizeNullableString(payload.contractedFee),
    customCaseType: normalizeNullableString(payload.customCaseType),
    caseNumber: normalizeNullableString(payload.caseNumber),
    courtName: normalizeNullableString(payload.courtName),
    description: normalizeNullableString(payload.description),
  }
  // isCmkAssignment kullanıcı boolean olarak gönderir; undefined ise dokunma.
  if (payload.isCmkAssignment !== undefined) {
    normalized.isCmkAssignment = !!payload.isCmkAssignment
  }
  return normalized
}

// Query string'den gelen status/caseType doğrulaması — geçersiz değer Drizzle eq
// üzerinden DB'ye gidip "invalid input value for enum" 500'üne yol açıyordu.
// Bilinen enum değerleri ile sınırla; bilinmeyense filtre uygulanmaz.
const VALID_CASE_STATUSES = new Set([
  'active', 'passive', 'closed', 'won', 'lost', 'settled', 'istinafta', 'yargıtayda',
])
const VALID_CASE_TYPES = new Set([
  'iscilik_alacagi', 'bosanma', 'velayet', 'mal_paylasimi', 'kira', 'tuketici',
  'icra', 'ceza', 'idare', 'diger',
])

// POST /api/cases/backfill-cmk — başlığı "CMK" ile başlayan davaları is_cmk_assignment=true yapar.
// Tamamen additive: hiçbir kayıt silinmez, sadece flag atılır. Idempotent (zaten true olanlara dokunmaz).
// Kullanıcı CMK sayfasından manuel tetikler; dönüş kaç satırın etkilendiğini gösterir.
router.post('/backfill-cmk', async (req, res) => {
  const dryRun = req.query.dryRun === 'true'

  // Önce etkilenecek satırları seç (dry-run desteği)
  const candidates = await db
    .select({ id: cases.id, title: cases.title })
    .from(cases)
    .where(
      and(
        eq(cases.userId, req.user!.userId),
        isNull(cases.archivedAt),
        eq(cases.isCmkAssignment, false),
        sql`${cases.title} ILIKE 'CMK%'`,
      ),
    )

  if (dryRun || candidates.length === 0) {
    res.json({
      dryRun,
      affected: candidates.length,
      titles: candidates.map((c) => c.title),
    })
    return
  }

  await db
    .update(cases)
    .set({ isCmkAssignment: true, updatedAt: new Date() })
    .where(
      and(
        eq(cases.userId, req.user!.userId),
        isNull(cases.archivedAt),
        eq(cases.isCmkAssignment, false),
        sql`${cases.title} ILIKE 'CMK%'`,
      ),
    )

  res.json({
    dryRun: false,
    affected: candidates.length,
    titles: candidates.map((c) => c.title),
  })
})

router.get('/', async (req, res) => {
  const search = getSingleValue(req.query.search)
  const status = getSingleValue(req.query.status)
  const statusGroup = getSingleValue(req.query.statusGroup)
  const caseType = getSingleValue(req.query.caseType)
  // isCmk: 'only' → sadece CMK görevlendirmeleri
  //         'include' → CMK dahil tüm davalar
  //         (default) → CMK hariç (davalar listesi)
  const isCmkParam = getSingleValue(req.query.isCmk)
  const page = getPositiveInt(req.query.page, 1)
  const pageSize = getPositiveInt(req.query.pageSize, 20)
  const offset = (page - 1) * pageSize

  const conditions = [eq(cases.userId, req.user!.userId), isNull(cases.archivedAt)]

  if (isCmkParam === 'only') {
    conditions.push(eq(cases.isCmkAssignment, true))
  } else if (isCmkParam !== 'include') {
    // Default: CMK davalarını davalar listesinden gizle
    conditions.push(eq(cases.isCmkAssignment, false))
  }

  if (search?.trim()) {
    const trimmedSearch = search.trim()
    conditions.push(
      or(
        ilike(cases.title, `%${trimmedSearch}%`),
        ilike(cases.caseNumber, `%${trimmedSearch}%`),
        ilike(cases.courtName, `%${trimmedSearch}%`),
        ilike(cases.description, `%${trimmedSearch}%`),
        ilike(clients.fullName, `%${trimmedSearch}%`)
      )!
    )
  }

  if (statusGroup === 'active') {
    conditions.push(
      or(
        eq(cases.status, 'active'),
        eq(cases.status, 'istinafta'),
        eq(cases.status, 'yargıtayda')
      )!
    )
  }

  if (statusGroup === 'pending') {
    conditions.push(eq(cases.status, 'passive'))
  }

  if (statusGroup === 'finished') {
    conditions.push(
      or(
        eq(cases.status, 'won'),
        eq(cases.status, 'lost'),
        eq(cases.status, 'settled'),
        eq(cases.status, 'closed')
      )!
    )
  }

  if (status && VALID_CASE_STATUSES.has(status)) {
    conditions.push(eq(cases.status, status as any))
  }

  if (caseType && VALID_CASE_TYPES.has(caseType)) {
    conditions.push(eq(cases.caseType, caseType as any))
  }

  const where = and(...conditions)

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        courtName: cases.courtName,
        caseType: cases.caseType,
        status: cases.status,
        title: cases.title,
        startDate: cases.startDate,
        contractedFee: cases.contractedFee,
        clientId: cases.clientId,
        clientName: clients.fullName,
        isCmkAssignment: cases.isCmkAssignment,
        createdAt: cases.createdAt,
      })
      .from(cases)
      .leftJoin(clients, eq(cases.clientId, clients.id))
      .where(where)
      // 3-katmanlı sıralama: aktif (1) → istinaf/yargıtay (2) → biten (3) → pasif (4)
      // Her grup içinde createdAt DESC. Avukatın talebi: en yeni aktif üstte,
      // en eski biten en altta, istinaf/yargıtay aktiflerin altında.
      .orderBy(
        sql`CASE ${cases.status}
          WHEN 'active' THEN 1
          WHEN 'istinafta' THEN 2
          WHEN 'yargıtayda' THEN 2
          WHEN 'won' THEN 3
          WHEN 'lost' THEN 3
          WHEN 'settled' THEN 3
          WHEN 'closed' THEN 3
          WHEN 'passive' THEN 4
          ELSE 5
        END ASC`,
        desc(cases.createdAt),
      )
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(cases)
      .leftJoin(clients, eq(cases.clientId, clients.id))
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

router.get('/:id', async (req, res) => {
  const caseId = getSingleValue(req.params.id)

  if (!caseId) {
    res.status(400).json({ error: 'Gecersiz dava id.' })
    return
  }

  const [caseData] = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      courtName: cases.courtName,
      caseType: cases.caseType,
      status: cases.status,
      title: cases.title,
      description: cases.description,
      startDate: cases.startDate,
      closeDate: cases.closeDate,
      contractedFee: cases.contractedFee,
      currency: cases.currency,
      customCaseType: cases.customCaseType,
      isCmkAssignment: cases.isCmkAssignment,
      clientId: cases.clientId,
      clientName: clients.fullName,
      clientPhone: clients.phone,
      createdAt: cases.createdAt,
      updatedAt: cases.updatedAt,
    })
    .from(cases)
    .leftJoin(clients, eq(cases.clientId, clients.id))
    .where(and(eq(cases.id, caseId), eq(cases.userId, req.user!.userId), isNull(cases.archivedAt)))
    .limit(1)

  if (!caseData) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  res.json(caseData)
})

// Tek roundtrip — dava detay sayfası için tüm veriyi birleştirilmiş döner.
// CaseDetailPage 6 ayrı istek yerine bunu kullanır.
router.get('/:id/detail', async (req, res) => {
  const caseId = getSingleValue(req.params.id)
  if (!caseId) {
    res.status(400).json({ error: 'Gecersiz dava id.' })
    return
  }

  const ownedCase = await getOwnedCase(req.user!.userId, caseId)
  if (!ownedCase) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const [caseRow] = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      courtName: cases.courtName,
      caseType: cases.caseType,
      status: cases.status,
      title: cases.title,
      description: cases.description,
      startDate: cases.startDate,
      closeDate: cases.closeDate,
      contractedFee: cases.contractedFee,
      currency: cases.currency,
      customCaseType: cases.customCaseType,
      isCmkAssignment: cases.isCmkAssignment,
      clientId: cases.clientId,
      clientName: clients.fullName,
      clientPhone: clients.phone,
      createdAt: cases.createdAt,
      updatedAt: cases.updatedAt,
    })
    .from(cases)
    .leftJoin(clients, eq(cases.clientId, clients.id))
    .where(and(eq(cases.id, caseId), eq(cases.userId, req.user!.userId), isNull(cases.archivedAt)))
    .limit(1)

  const [hearings, caseTasks, caseExpenses, caseCollections, caseNotes, caseDocuments] =
    await Promise.all([
      db
        .select()
        .from(caseHearings)
        .where(and(eq(caseHearings.caseId, caseId), isNull(caseHearings.archivedAt)))
        .orderBy(desc(caseHearings.hearingDate)),
      db
        .select()
        .from(tasks)
        .where(and(eq(tasks.caseId, caseId), isNull(tasks.archivedAt)))
        .orderBy(desc(tasks.createdAt)),
      db
        .select()
        .from(expenses)
        .where(and(eq(expenses.caseId, caseId), isNull(expenses.archivedAt)))
        .orderBy(desc(expenses.createdAt)),
      db
        .select()
        .from(collections)
        .where(and(eq(collections.caseId, caseId), isNull(collections.archivedAt)))
        .orderBy(desc(collections.createdAt)),
      db
        .select()
        .from(notes)
        .where(and(eq(notes.caseId, caseId), isNull(notes.archivedAt)))
        .orderBy(desc(notes.createdAt)),
      db
        .select()
        .from(documents)
        .where(and(eq(documents.caseId, caseId), isNull(documents.archivedAt)))
        .orderBy(desc(documents.createdAt)),
    ])

  const totalCollected = caseCollections.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  )
  const totalSpent = caseExpenses.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  )
  const contractedFee = Number(caseRow?.contractedFee || 0)
  const remaining = contractedFee > 0 ? Math.max(0, contractedFee - totalCollected) : 0

  res.json({
    case: caseRow,
    financials: {
      contractedFee,
      totalCollected,
      totalSpent,
      remaining,
    },
    hearings,
    tasks: caseTasks,
    expenses: caseExpenses,
    collections: caseCollections,
    notes: caseNotes,
    documents: caseDocuments,
  })
})

router.post('/', validate(createCaseSchema), async (req, res) => {
  const [newCase] = await db
    .insert(cases)
    .values({
      ...normalizeCasePayload(req.body),
      userId: req.user!.userId,
    })
    .returning()

  res.status(201).json(newCase)
})

router.put('/:id', validate(updateCaseSchema), async (req, res) => {
  const caseId = getSingleValue(req.params.id)

  if (!caseId) {
    res.status(400).json({ error: 'Gecersiz dava id.' })
    return
  }

  // Status değişikliği takibi için eski hali al — diary log'a "X → Y" düşürürüz.
  const [previous] = await db
    .select({ status: cases.status })
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.userId, req.user!.userId), isNull(cases.archivedAt)))
    .limit(1)

  const [updated] = await db
    .update(cases)
    .set({
      ...normalizeCasePayload(req.body),
      updatedAt: new Date(),
    })
    .where(and(eq(cases.id, caseId), eq(cases.userId, req.user!.userId), isNull(cases.archivedAt)))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  // Durum değiştiyse günlüğe "X → Y" girdisi düşür
  if (previous?.status && updated.status && previous.status !== updated.status) {
    const fromLabel = CASE_STATUS_LABELS[previous.status] || previous.status
    const toLabel = CASE_STATUS_LABELS[updated.status] || updated.status
    void logDiaryEntry({
      caseId: updated.id,
      userId: req.user!.userId,
      entryType: 'status_changed',
      title: 'Dava durumu değişti',
      content: `${fromLabel} → ${toLabel}`,
      linkedEntityType: 'case',
      linkedEntityId: updated.id,
    })
  }

  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  const caseId = getSingleValue(req.params.id)

  if (!caseId) {
    res.status(400).json({ error: 'Gecersiz dava id.' })
    return
  }

  const [deleted] = await db
    .update(cases)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(cases.id, caseId), eq(cases.userId, req.user!.userId), isNull(cases.archivedAt)))
    .returning()

  if (!deleted) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const archivedAt = deleted.archivedAt || new Date()
  await Promise.all([
    db.update(caseHearings).set({ archivedAt, updatedAt: new Date() }).where(and(eq(caseHearings.caseId, caseId), isNull(caseHearings.archivedAt))),
    db.update(tasks).set({ archivedAt, updatedAt: new Date() }).where(and(eq(tasks.caseId, caseId), isNull(tasks.archivedAt))),
    db.update(expenses).set({ archivedAt }).where(and(eq(expenses.caseId, caseId), isNull(expenses.archivedAt))),
    db.update(collections).set({ archivedAt }).where(and(eq(collections.caseId, caseId), isNull(collections.archivedAt))),
    db.update(notes).set({ archivedAt, updatedAt: new Date() }).where(and(eq(notes.caseId, caseId), isNull(notes.archivedAt))),
    db.update(documents).set({ archivedAt }).where(and(eq(documents.caseId, caseId), isNull(documents.archivedAt))),
  ])

  res.json({ message: 'Dava arşivlendi.' })
})

router.get('/:id/hearings', async (req, res) => {
  const caseId = getSingleValue(req.params.id)

  if (!caseId) {
    res.status(400).json({ error: 'Gecersiz dava id.' })
    return
  }

  const ownedCase = await getOwnedCase(req.user!.userId, caseId)
  if (!ownedCase) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const data = await db
    .select()
    .from(caseHearings)
    .where(and(eq(caseHearings.caseId, caseId), isNull(caseHearings.archivedAt)))
    .orderBy(desc(caseHearings.hearingDate))

  res.json(data)
})

router.get('/:id/tasks', async (req, res) => {
  const caseId = getSingleValue(req.params.id)

  if (!caseId) {
    res.status(400).json({ error: 'Gecersiz dava id.' })
    return
  }

  const ownedCase = await getOwnedCase(req.user!.userId, caseId)
  if (!ownedCase) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const data = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.caseId, caseId), isNull(tasks.archivedAt)))
    .orderBy(desc(tasks.createdAt))

  res.json(data)
})

router.get('/:id/expenses', async (req, res) => {
  const caseId = getSingleValue(req.params.id)

  if (!caseId) {
    res.status(400).json({ error: 'Gecersiz dava id.' })
    return
  }

  const ownedCase = await getOwnedCase(req.user!.userId, caseId)
  if (!ownedCase) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const data = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.caseId, caseId), isNull(expenses.archivedAt)))
    .orderBy(desc(expenses.createdAt))

  res.json(data)
})

router.get('/:id/collections', async (req, res) => {
  const caseId = getSingleValue(req.params.id)

  if (!caseId) {
    res.status(400).json({ error: 'Gecersiz dava id.' })
    return
  }

  const ownedCase = await getOwnedCase(req.user!.userId, caseId)
  if (!ownedCase) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const data = await db
    .select()
    .from(collections)
    .where(and(eq(collections.caseId, caseId), isNull(collections.archivedAt)))
    .orderBy(desc(collections.createdAt))

  res.json(data)
})

router.get('/:id/notes', async (req, res) => {
  const caseId = getSingleValue(req.params.id)

  if (!caseId) {
    res.status(400).json({ error: 'Gecersiz dava id.' })
    return
  }

  const ownedCase = await getOwnedCase(req.user!.userId, caseId)
  if (!ownedCase) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const data = await db
    .select()
    .from(notes)
    .where(and(eq(notes.caseId, caseId), isNull(notes.archivedAt)))
    .orderBy(desc(notes.createdAt))

  res.json(data)
})

router.get('/:id/documents', async (req, res) => {
  const caseId = getSingleValue(req.params.id)

  if (!caseId) {
    res.status(400).json({ error: 'Gecersiz dava id.' })
    return
  }

  const ownedCase = await getOwnedCase(req.user!.userId, caseId)
  if (!ownedCase) {
    res.status(404).json({ error: 'Dava bulunamadi.' })
    return
  }

  const data = await db
    .select()
    .from(documents)
    .where(and(eq(documents.caseId, caseId), isNull(documents.archivedAt)))
    .orderBy(desc(documents.createdAt))

  res.json(data)
})

export default router
