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

const router = Router()
router.use(authenticate)

function normalizeNullableString(value: unknown) {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function normalizeCasePayload(payload: any) {
  return {
    ...payload,
    startDate: normalizeNullableString(payload.startDate),
    closeDate: normalizeNullableString(payload.closeDate),
    contractedFee: normalizeNullableString(payload.contractedFee),
    customCaseType: normalizeNullableString(payload.customCaseType),
    caseNumber: normalizeNullableString(payload.caseNumber),
    courtName: normalizeNullableString(payload.courtName),
    description: normalizeNullableString(payload.description),
  }
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

router.get('/', async (req, res) => {
  const search = getSingleValue(req.query.search)
  const status = getSingleValue(req.query.status)
  const statusGroup = getSingleValue(req.query.statusGroup)
  const caseType = getSingleValue(req.query.caseType)
  const page = getPositiveInt(req.query.page, 1)
  const pageSize = getPositiveInt(req.query.pageSize, 20)
  const offset = (page - 1) * pageSize

  const conditions = [eq(cases.userId, req.user!.userId), isNull(cases.archivedAt)]

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
        createdAt: cases.createdAt,
      })
      .from(cases)
      .leftJoin(clients, eq(cases.clientId, clients.id))
      .where(where)
      .orderBy(desc(cases.createdAt))
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

  res.json({
    case: caseRow,
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
