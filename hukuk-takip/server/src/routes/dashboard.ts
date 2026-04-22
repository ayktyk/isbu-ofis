import { Router } from 'express'
import { and, desc, eq, gte, lte, or, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  caseHearings,
  cases,
  clients,
  collections,
  consultations,
  mediationFiles,
  tasks,
} from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { ensureRecentReminderScan } from '../services/notificationScheduler.js'

const router = Router()
router.use(authenticate)

// Dashboard/summary çağrılarında arka planda reminder scan tetikle (fire-and-forget).
// Cron güvenilmezse bile kullanıcının her dashboard ziyareti bildirimleri güncel tutar.
function triggerReminderScanInBackground() {
  const scan = ensureRecentReminderScan(false)
  if (scan) {
    scan.catch(() => {}) // Logging scheduler içinde; dashboard'u bloklama
  }
}

// Owner'ın tahsilat toplamını tutar: hem dava bazlı (collections.user_id ya da case.user_id)
// hem arabuluculuk bazlı (mediation.user_id) tahsilatları toplar.
const userOwnedCollectionsClause = (userId: string) =>
  sql`(
    ${collections.userId} = ${userId}
    OR EXISTS (SELECT 1 FROM ${cases} WHERE ${cases.id} = ${collections.caseId} AND ${cases.userId} = ${userId})
    OR EXISTS (SELECT 1 FROM ${mediationFiles} WHERE ${mediationFiles.id} = ${collections.mediationFileId} AND ${mediationFiles.userId} = ${userId})
  )`

router.get('/', async (req, res) => {
  triggerReminderScanInBackground()
  const userId = req.user!.userId
  const now = new Date()
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [
    caseStats,
    upcomingHearings,
    pendingTasks,
    recentCases,
    totalCollections,
    outstandingCases,
    outstandingMediations,
    potentialConsultations,
  ] = await Promise.all([
    db
      .select({
        status: cases.status,
        count: sql<number>`count(*)::int`,
      })
      .from(cases)
      .where(eq(cases.userId, userId))
      .groupBy(cases.status),

    db
      .select({
        caseId: cases.id,
        id: caseHearings.id,
        hearingDate: caseHearings.hearingDate,
        courtRoom: caseHearings.courtRoom,
        caseTitle: cases.title,
        caseNumber: cases.caseNumber,
        courtName: cases.courtName,
        clientName: clients.fullName,
      })
      .from(caseHearings)
      .innerJoin(cases, eq(caseHearings.caseId, cases.id))
      .leftJoin(clients, eq(cases.clientId, clients.id))
      .where(
        and(
          eq(cases.userId, userId),
          gte(caseHearings.hearingDate, now),
          lte(caseHearings.hearingDate, sevenDaysLater),
          eq(caseHearings.result, 'pending')
        )
      )
      .orderBy(caseHearings.hearingDate)
      .limit(10),

    db
      .select({
        id: tasks.id,
        title: tasks.title,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        caseTitle: cases.title,
      })
      .from(tasks)
      .leftJoin(cases, eq(tasks.caseId, cases.id))
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'pending')))
      .orderBy(tasks.dueDate)
      .limit(10),

    db
      .select({
        id: cases.id,
        title: cases.title,
        caseType: cases.caseType,
        status: cases.status,
        clientName: clients.fullName,
        createdAt: cases.createdAt,
      })
      .from(cases)
      .leftJoin(clients, eq(cases.clientId, clients.id))
      .where(eq(cases.userId, userId))
      .orderBy(desc(cases.createdAt))
      .limit(5),

    // Toplam tahsilat (dava + arabuluculuk)
    db
      .select({
        total: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
        caseTotal: sql<string>`COALESCE(SUM(CASE WHEN ${collections.caseId} IS NOT NULL THEN ${collections.amount}::numeric ELSE 0 END), 0)::text`,
        mediationTotal: sql<string>`COALESCE(SUM(CASE WHEN ${collections.mediationFileId} IS NOT NULL THEN ${collections.amount}::numeric ELSE 0 END), 0)::text`,
      })
      .from(collections)
      .where(userOwnedCollectionsClause(userId)),

    // Bekleyen ücret — davalar
    db
      .select({
        id: cases.id,
        title: cases.title,
        clientName: clients.fullName,
        contractedFee: cases.contractedFee,
        totalCollected: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
        remaining: sql<string>`(${cases.contractedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0))::text`,
        source: sql<string>`'case'`,
      })
      .from(cases)
      .leftJoin(clients, eq(cases.clientId, clients.id))
      .leftJoin(collections, eq(collections.caseId, cases.id))
      .where(
        and(
          eq(cases.userId, userId),
          sql`${cases.contractedFee} IS NOT NULL`,
          sql`${cases.contractedFee}::numeric > 0`,
          or(eq(cases.status, 'active'), eq(cases.status, 'istinafta'), eq(cases.status, 'yargıtayda'))
        )
      )
      .groupBy(cases.id, cases.title, cases.contractedFee, clients.fullName)
      .having(sql`${cases.contractedFee}::numeric > COALESCE(SUM(${collections.amount}::numeric), 0)`)
      .orderBy(sql`${cases.contractedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0) DESC`)
      .limit(10),

    // Bekleyen ücret — arabuluculuklar
    db
      .select({
        id: mediationFiles.id,
        title: sql<string>`COALESCE(${mediationFiles.fileNo}, ${mediationFiles.disputeType})`,
        clientName: sql<string>`${mediationFiles.disputeType}`,
        contractedFee: mediationFiles.agreedFee,
        totalCollected: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
        remaining: sql<string>`(${mediationFiles.agreedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0))::text`,
        source: sql<string>`'mediation'`,
      })
      .from(mediationFiles)
      .leftJoin(collections, eq(collections.mediationFileId, mediationFiles.id))
      .where(
        and(
          eq(mediationFiles.userId, userId),
          sql`${mediationFiles.agreedFee} IS NOT NULL`,
          sql`${mediationFiles.agreedFee}::numeric > 0`,
          eq(mediationFiles.status, 'active')
        )
      )
      .groupBy(mediationFiles.id, mediationFiles.fileNo, mediationFiles.disputeType, mediationFiles.agreedFee)
      .having(sql`${mediationFiles.agreedFee}::numeric > COALESCE(SUM(${collections.amount}::numeric), 0)`)
      .orderBy(sql`${mediationFiles.agreedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0) DESC`)
      .limit(10),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(consultations)
      .where(and(eq(consultations.userId, userId), eq(consultations.status, 'potential'))),
  ])

  const caseCount = {
    total: 0,
    active: 0,
    pending: 0,
    finished: 0,
    won: 0,
    lost: 0,
    settled: 0,
    closed: 0,
  }

  for (const stat of caseStats) {
    caseCount.total += stat.count

    if (stat.status === 'active' || stat.status === 'istinafta' || stat.status === 'yargıtayda') {
      caseCount.active += stat.count
    }

    if (stat.status === 'passive') {
      caseCount.pending += stat.count
    }

    if (stat.status === 'won' || stat.status === 'lost' || stat.status === 'settled' || stat.status === 'closed') {
      caseCount.finished += stat.count
      caseCount[stat.status as 'won' | 'lost' | 'settled' | 'closed'] = stat.count
    }
  }

  // Potansiyel görüşmeleri de "potansiyel davalar" sayısına ekle
  const potentialConsultationCount = potentialConsultations[0]?.count ?? 0
  caseCount.pending += potentialConsultationCount

  // Bekleyen ücret toplamı (dava + arabuluculuk)
  const outstandingByCases = outstandingCases.reduce(
    (sum, r) => sum + parseFloat(r.remaining || '0'),
    0
  )
  const outstandingByMediations = outstandingMediations.reduce(
    (sum, r) => sum + parseFloat(r.remaining || '0'),
    0
  )
  const outstandingTotal = outstandingByCases + outstandingByMediations

  // Birleştirilmiş ve sıralanmış liste (en büyük bekleyen üstte)
  const outstandingFees = [...outstandingCases, ...outstandingMediations].sort(
    (a, b) => parseFloat(b.remaining || '0') - parseFloat(a.remaining || '0')
  )

  res.json({
    cases: caseCount,
    upcomingHearings,
    pendingTasks,
    recentCases,
    financials: {
      totalCollections: totalCollections[0]?.total ?? '0',
      totalCaseCollections: totalCollections[0]?.caseTotal ?? '0',
      totalMediationCollections: totalCollections[0]?.mediationTotal ?? '0',
      outstandingTotal: outstandingTotal.toFixed(2),
      outstandingByCases: outstandingByCases.toFixed(2),
      outstandingByMediations: outstandingByMediations.toFixed(2),
    },
    outstandingFees,
    potentialConsultationsCount: potentialConsultationCount,
  })
})

// ─── GET /api/dashboard/summary ──────────────────────────────────────────────
// Dashboard + this-month income + consultation stats — tek istek, tek roundtrip.
// DashboardPage'in 3 ayrı query yerine bunu kullanması performans için.

router.get('/summary', async (req, res) => {
  triggerReminderScanInBackground()
  const userId = req.user!.userId
  const now = new Date()
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [
    caseStats,
    upcomingHearings,
    pendingTasks,
    recentCases,
    totalCollections,
    outstandingCases,
    outstandingMediations,
    potentialConsultations,
    thisMonthIncome,
    consultationStats,
  ] = await Promise.all([
    db
      .select({ status: cases.status, count: sql<number>`count(*)::int` })
      .from(cases)
      .where(eq(cases.userId, userId))
      .groupBy(cases.status),

    db
      .select({
        caseId: cases.id,
        id: caseHearings.id,
        hearingDate: caseHearings.hearingDate,
        courtRoom: caseHearings.courtRoom,
        caseTitle: cases.title,
        caseNumber: cases.caseNumber,
        courtName: cases.courtName,
        clientName: clients.fullName,
      })
      .from(caseHearings)
      .innerJoin(cases, eq(caseHearings.caseId, cases.id))
      .leftJoin(clients, eq(cases.clientId, clients.id))
      .where(
        and(
          eq(cases.userId, userId),
          gte(caseHearings.hearingDate, now),
          lte(caseHearings.hearingDate, sevenDaysLater),
          eq(caseHearings.result, 'pending')
        )
      )
      .orderBy(caseHearings.hearingDate)
      .limit(10),

    db
      .select({
        id: tasks.id,
        title: tasks.title,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        caseTitle: cases.title,
      })
      .from(tasks)
      .leftJoin(cases, eq(tasks.caseId, cases.id))
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'pending')))
      .orderBy(tasks.dueDate)
      .limit(10),

    db
      .select({
        id: cases.id,
        title: cases.title,
        caseType: cases.caseType,
        status: cases.status,
        clientName: clients.fullName,
        createdAt: cases.createdAt,
      })
      .from(cases)
      .leftJoin(clients, eq(cases.clientId, clients.id))
      .where(eq(cases.userId, userId))
      .orderBy(desc(cases.createdAt))
      .limit(5),

    db
      .select({
        total: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
        caseTotal: sql<string>`COALESCE(SUM(CASE WHEN ${collections.caseId} IS NOT NULL THEN ${collections.amount}::numeric ELSE 0 END), 0)::text`,
        mediationTotal: sql<string>`COALESCE(SUM(CASE WHEN ${collections.mediationFileId} IS NOT NULL THEN ${collections.amount}::numeric ELSE 0 END), 0)::text`,
      })
      .from(collections)
      .where(userOwnedCollectionsClause(userId)),

    db
      .select({
        id: cases.id,
        title: cases.title,
        clientName: clients.fullName,
        contractedFee: cases.contractedFee,
        totalCollected: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
        remaining: sql<string>`(${cases.contractedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0))::text`,
        source: sql<string>`'case'`,
      })
      .from(cases)
      .leftJoin(clients, eq(cases.clientId, clients.id))
      .leftJoin(collections, eq(collections.caseId, cases.id))
      .where(
        and(
          eq(cases.userId, userId),
          sql`${cases.contractedFee} IS NOT NULL`,
          sql`${cases.contractedFee}::numeric > 0`,
          or(eq(cases.status, 'active'), eq(cases.status, 'istinafta'), eq(cases.status, 'yargıtayda'))
        )
      )
      .groupBy(cases.id, cases.title, cases.contractedFee, clients.fullName)
      .having(sql`${cases.contractedFee}::numeric > COALESCE(SUM(${collections.amount}::numeric), 0)`)
      .orderBy(sql`${cases.contractedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0) DESC`)
      .limit(10),

    db
      .select({
        id: mediationFiles.id,
        title: sql<string>`COALESCE(${mediationFiles.fileNo}, ${mediationFiles.disputeType})`,
        clientName: sql<string>`${mediationFiles.disputeType}`,
        contractedFee: mediationFiles.agreedFee,
        totalCollected: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
        remaining: sql<string>`(${mediationFiles.agreedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0))::text`,
        source: sql<string>`'mediation'`,
      })
      .from(mediationFiles)
      .leftJoin(collections, eq(collections.mediationFileId, mediationFiles.id))
      .where(
        and(
          eq(mediationFiles.userId, userId),
          sql`${mediationFiles.agreedFee} IS NOT NULL`,
          sql`${mediationFiles.agreedFee}::numeric > 0`,
          eq(mediationFiles.status, 'active')
        )
      )
      .groupBy(mediationFiles.id, mediationFiles.fileNo, mediationFiles.disputeType, mediationFiles.agreedFee)
      .having(sql`${mediationFiles.agreedFee}::numeric > COALESCE(SUM(${collections.amount}::numeric), 0)`)
      .orderBy(sql`${mediationFiles.agreedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0) DESC`)
      .limit(10),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(consultations)
      .where(and(eq(consultations.userId, userId), eq(consultations.status, 'potential'))),

    // Bu ay gelir — dava + arabuluculuk kırılımı
    db
      .select({
        caseAmount: sql<string>`COALESCE(SUM(CASE WHEN ${collections.caseId} IS NOT NULL THEN ${collections.amount}::numeric ELSE 0 END), 0)::text`,
        mediationAmount: sql<string>`COALESCE(SUM(CASE WHEN ${collections.mediationFileId} IS NOT NULL THEN ${collections.amount}::numeric ELSE 0 END), 0)::text`,
      })
      .from(collections)
      .where(
        and(
          userOwnedCollectionsClause(userId),
          sql`TO_CHAR(${collections.collectionDate}, 'YYYY-MM') = ${currentMonthKey}`
        )
      ),

    // Görüşme stats (kısa)
    db
      .select({ status: consultations.status, count: sql<number>`count(*)::int` })
      .from(consultations)
      .where(eq(consultations.userId, userId))
      .groupBy(consultations.status),
  ])

  const caseCount = {
    total: 0,
    active: 0,
    pending: 0,
    finished: 0,
    won: 0,
    lost: 0,
    settled: 0,
    closed: 0,
  }
  for (const stat of caseStats) {
    caseCount.total += stat.count
    if (stat.status === 'active' || stat.status === 'istinafta' || stat.status === 'yargıtayda') caseCount.active += stat.count
    if (stat.status === 'passive') caseCount.pending += stat.count
    if (stat.status === 'won' || stat.status === 'lost' || stat.status === 'settled' || stat.status === 'closed') {
      caseCount.finished += stat.count
      caseCount[stat.status as 'won' | 'lost' | 'settled' | 'closed'] = stat.count
    }
  }
  const potentialConsultationCount = potentialConsultations[0]?.count ?? 0
  caseCount.pending += potentialConsultationCount

  const outstandingByCases = outstandingCases.reduce((sum, r) => sum + parseFloat(r.remaining || '0'), 0)
  const outstandingByMediations = outstandingMediations.reduce((sum, r) => sum + parseFloat(r.remaining || '0'), 0)
  const outstandingTotal = outstandingByCases + outstandingByMediations
  const outstandingFees = [...outstandingCases, ...outstandingMediations].sort(
    (a, b) => parseFloat(b.remaining || '0') - parseFloat(a.remaining || '0')
  )

  const thisMonth = thisMonthIncome[0] || { caseAmount: '0', mediationAmount: '0' }
  const thisMonthCase = parseFloat(thisMonth.caseAmount || '0')
  const thisMonthMediation = parseFloat(thisMonth.mediationAmount || '0')

  res.json({
    cases: caseCount,
    upcomingHearings,
    pendingTasks,
    recentCases,
    financials: {
      totalCollections: totalCollections[0]?.total ?? '0',
      totalCaseCollections: totalCollections[0]?.caseTotal ?? '0',
      totalMediationCollections: totalCollections[0]?.mediationTotal ?? '0',
      outstandingTotal: outstandingTotal.toFixed(2),
      outstandingByCases: outstandingByCases.toFixed(2),
      outstandingByMediations: outstandingByMediations.toFixed(2),
      thisMonthCaseIncome: thisMonthCase.toFixed(2),
      thisMonthMediationIncome: thisMonthMediation.toFixed(2),
      thisMonthTotalIncome: (thisMonthCase + thisMonthMediation).toFixed(2),
    },
    outstandingFees,
    consultations: {
      potential: potentialConsultationCount,
      byStatus: consultationStats,
    },
  })
})

export default router
