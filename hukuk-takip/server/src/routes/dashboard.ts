import { Router } from 'express'
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
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
import {
  getOutstandingCaseFees,
  getOutstandingMediationFees,
  sumOutstanding,
} from '../utils/outstandingFees.js'

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

// Dashboard, 14 paralel sorgu yürütüyor. Tek bir sorgunun çökmesi (geçici DB
// hatası, network blip vb.) tüm response'u 500'e götürmesin diye allSettled
// kullanıyoruz; başarısız blok için emniyetli default döner. Hiçbir veri silinmez,
// sadece o sorgu o istek için boş set olarak görünür ve loglanır.
async function safeQuery<T>(label: string, runner: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await runner()
  } catch (err) {
    console.error(`[Dashboard] ${label} sorgusu hata verdi, fallback kullanılıyor:`, err)
    return fallback
  }
}

// String numeric değeri güvenle float'a çevir. NaN/Infinity → 0. Aksi halde
// dashboard "NaN" string'i göstermek zorunda kalıyor (frontend "-" çevirir
// ama yanlış sıralama / yanlış toplam üretir).
function safeNumeric(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

// Owner'ın tahsilat toplamını tutar: hem dava bazlı (collections.user_id ya da case.user_id)
// hem arabuluculuk bazlı (mediation.user_id) tahsilatları toplar.
const userOwnedCollectionsClause = (userId: string) =>
  sql`(
    ${collections.archivedAt} IS NULL
    AND (
      ${collections.userId} = ${userId}
      OR EXISTS (SELECT 1 FROM ${cases} WHERE ${cases.id} = ${collections.caseId} AND ${cases.userId} = ${userId} AND ${cases.archivedAt} IS NULL)
      OR EXISTS (SELECT 1 FROM ${mediationFiles} WHERE ${mediationFiles.id} = ${collections.mediationFileId} AND ${mediationFiles.userId} = ${userId} AND ${mediationFiles.archivedAt} IS NULL)
    )
  )`

// Kritik süreli işler — önümüzdeki N gün içinde son bulan, hala açık olanlar.
// Dashboard'un "kaçıramayacağınız süreler" bandı için.
async function loadCriticalDeadlines(userId: string, withinDays = 7) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + withinDays)

  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      caseId: tasks.caseId,
      caseTitle: cases.title,
      deadlineCategory: tasks.deadlineCategory,
      deadlineSeverity: tasks.deadlineSeverity,
      legalBasis: tasks.legalBasis,
    })
    .from(tasks)
    .leftJoin(cases, eq(tasks.caseId, cases.id))
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.isDeadline, true),
        isNull(tasks.archivedAt),
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, start),
        lte(tasks.dueDate, end),
        inArray(tasks.status, ['pending', 'in_progress'])
      )
    )
    .orderBy(asc(tasks.dueDate))
    .limit(20)
}

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
    outstandingCasesAll,
    outstandingMediationsAll,
    potentialConsultations,
    criticalDeadlines,
  ] = await Promise.all([
    db
      .select({
        status: cases.status,
        count: sql<number>`count(*)::int`,
      })
      .from(cases)
      .where(and(eq(cases.userId, userId), isNull(cases.archivedAt)))
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
          isNull(cases.archivedAt),
          isNull(caseHearings.archivedAt),
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
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.status, 'pending'),
          eq(tasks.isDeadline, false),
          isNull(tasks.archivedAt)
        )
      )
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
      .where(and(eq(cases.userId, userId), isNull(cases.archivedAt)))
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

    // Bekleyen ücret — davalar (CMK dahil; ayrım frontend tarafında rozet ile yapılır).
    // Tek kaynak: utils/outstandingFees.getOutstandingCaseFees — istatistik sayfası
    // ile aynı filtre/order kullanır.
    // Widget listesi LIMIT 20 ile sınırlı; ancak header'daki "Toplam" rakamı
    // statistics ile birebir tutsun diye AYRI bir limit'siz sorgu ile hesaplanır
    // (outstandingCasesAll). Aksi halde 20+ bekleyen davası olan kullanıcıda
    // dashboard widget toplamı statistics'ten düşük çıkıyordu.
    getOutstandingCaseFees(userId, { limit: 20 }),

    // Bekleyen ücret — arabuluculuklar (aynı helper)
    getOutstandingMediationFees(userId, { limit: 20 }),

    // Toplam hesabı için limit'siz aynı helper sorguları
    getOutstandingCaseFees(userId),
    getOutstandingMediationFees(userId),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(consultations)
      .where(and(eq(consultations.userId, userId), eq(consultations.status, 'potential'), isNull(consultations.archivedAt))),

    loadCriticalDeadlines(userId, 7),
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

  // Bekleyen ücret TOPLAMI: limit'siz sorgudan (outstandingCasesAll/Mediations)
  // hesaplanır ki Statistics sayfasındaki BigStat ile birebir tutsun.
  // Liste (outstandingCases/Mediations) ise LIMIT 20 — sadece görünür ilk satırlar.
  const outstandingByCases = sumOutstanding(outstandingCasesAll)
  const outstandingByMediations = sumOutstanding(outstandingMediationsAll)
  const outstandingTotal = outstandingByCases + outstandingByMediations

  // Birleştirilmiş ve sıralanmış liste (en yeni eklenen üstte, sonra büyük bekleyen)
  const outstandingFees = [...outstandingCases, ...outstandingMediations]

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
    criticalDeadlines,
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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)

  const [
    caseStats,
    upcomingHearings,
    pendingTasks,
    recentCases,
    totalCollections,
    outstandingCases,
    outstandingMediations,
    outstandingCasesAll,
    outstandingMediationsAll,
    potentialConsultations,
    thisMonthIncome,
    consultationStats,
    thisMonthCaseCount,
    thisMonthMediationCount,
    consultationDashboardStats,
    criticalDeadlines,
  ] = await Promise.all([
    safeQuery('caseStats', () => db
      .select({ status: cases.status, count: sql<number>`count(*)::int` })
      .from(cases)
      .where(and(eq(cases.userId, userId), isNull(cases.archivedAt)))
      .groupBy(cases.status), [] as { status: string; count: number }[]),

    safeQuery('upcomingHearings', () => db
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
          isNull(cases.archivedAt),
          isNull(caseHearings.archivedAt),
          gte(caseHearings.hearingDate, now),
          lte(caseHearings.hearingDate, sevenDaysLater),
          eq(caseHearings.result, 'pending')
        )
      )
      .orderBy(caseHearings.hearingDate)
      .limit(10), [] as any[]),

    safeQuery('pendingTasks', () => db
      .select({
        id: tasks.id,
        title: tasks.title,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        caseTitle: cases.title,
      })
      .from(tasks)
      .leftJoin(cases, eq(tasks.caseId, cases.id))
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.status, 'pending'),
          eq(tasks.isDeadline, false),
          isNull(tasks.archivedAt)
        )
      )
      .orderBy(tasks.dueDate)
      .limit(10), [] as any[]),

    safeQuery('recentCases', () => db
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
      .where(and(eq(cases.userId, userId), isNull(cases.archivedAt)))
      .orderBy(desc(cases.createdAt))
      .limit(5), [] as any[]),

    safeQuery('totalCollections', () => db
      .select({
        total: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
        caseTotal: sql<string>`COALESCE(SUM(CASE WHEN ${collections.caseId} IS NOT NULL THEN ${collections.amount}::numeric ELSE 0 END), 0)::text`,
        mediationTotal: sql<string>`COALESCE(SUM(CASE WHEN ${collections.mediationFileId} IS NOT NULL THEN ${collections.amount}::numeric ELSE 0 END), 0)::text`,
      })
      .from(collections)
      .where(userOwnedCollectionsClause(userId)), [{ total: '0', caseTotal: '0', mediationTotal: '0' }]),

    // Bekleyen ücret listesi — widget'a görünür ilk satırlar (LIMIT 20).
    // Tek kaynak: utils/outstandingFees — statistics ile aynı filtre/order.
    safeQuery(
      'outstandingCases',
      () => getOutstandingCaseFees(userId, { limit: 20 }),
      [] as any[],
    ),

    safeQuery(
      'outstandingMediations',
      () => getOutstandingMediationFees(userId, { limit: 20 }),
      [] as any[],
    ),

    // Toplam hesabı için limit'siz aynı sorgular — widget header'ındaki "Toplam"
    // statistics BigStat'ı ile birebir tutsun diye gerekli.
    safeQuery(
      'outstandingCasesAll',
      () => getOutstandingCaseFees(userId),
      [] as any[],
    ),

    safeQuery(
      'outstandingMediationsAll',
      () => getOutstandingMediationFees(userId),
      [] as any[],
    ),

    safeQuery('potentialConsultations', () => db
      .select({ count: sql<number>`count(*)::int` })
      .from(consultations)
      .where(and(eq(consultations.userId, userId), eq(consultations.status, 'potential'), isNull(consultations.archivedAt))), [{ count: 0 }]),

    // Bu ay gelir — dava + arabuluculuk kırılımı
    safeQuery('thisMonthIncome', () => db
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
      ), [{ caseAmount: '0', mediationAmount: '0' }]),

    // Görüşme stats (kısa)
    safeQuery('consultationStats', () => db
      .select({ status: consultations.status, count: sql<number>`count(*)::int` })
      .from(consultations)
      .where(and(eq(consultations.userId, userId), isNull(consultations.archivedAt)))
      .groupBy(consultations.status), [] as { status: string; count: number }[]),

    safeQuery('thisMonthCaseCount', () => db
      .select({ count: sql<number>`count(*)::int` })
      .from(cases)
      .where(and(eq(cases.userId, userId), isNull(cases.archivedAt), gte(cases.createdAt, monthStart))), [{ count: 0 }]),

    safeQuery('thisMonthMediationCount', () => db
      .select({ count: sql<number>`count(*)::int` })
      .from(mediationFiles)
      .where(
        and(
          eq(mediationFiles.userId, userId),
          isNull(mediationFiles.archivedAt),
          gte(mediationFiles.createdAt, monthStart)
        )
      ), [{ count: 0 }]),

    safeQuery('consultationDashboardStats', () => db
      .select({
        today: sql<number>`COUNT(*) FILTER (WHERE ${consultations.consultationDate} >= ${todayStart} AND ${consultations.consultationDate} <= ${todayEnd})::int`,
        week: sql<number>`COUNT(*) FILTER (WHERE ${consultations.consultationDate} >= ${weekStart})::int`,
        month: sql<number>`COUNT(*) FILTER (WHERE ${consultations.consultationDate} >= ${monthStart})::int`,
        converted: sql<number>`COUNT(*) FILTER (WHERE ${consultations.status} = 'converted' AND ${consultations.consultationDate} >= ${monthStart})::int`,
      })
      .from(consultations)
      .where(and(eq(consultations.userId, userId), isNull(consultations.archivedAt))), [{ today: 0, week: 0, month: 0, converted: 0 }]),

    // Kritik süreli işler — önümüzdeki 7 gün
    safeQuery('criticalDeadlines', () => loadCriticalDeadlines(userId, 7), [] as any[]),
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

  // Toplam: limit'siz sorgudan; liste: limit 20 — statistics ile birebir tutar.
  const outstandingByCases = sumOutstanding(outstandingCasesAll)
  const outstandingByMediations = sumOutstanding(outstandingMediationsAll)
  const outstandingTotal = outstandingByCases + outstandingByMediations
  const outstandingFees = [...outstandingCases, ...outstandingMediations]

  const thisMonth = thisMonthIncome[0] || { caseAmount: '0', mediationAmount: '0' }
  const thisMonthCase = safeNumeric(thisMonth.caseAmount)
  const thisMonthMediation = safeNumeric(thisMonth.mediationAmount)
  const consultationDashboard = consultationDashboardStats[0] || {
    today: 0,
    week: 0,
    month: 0,
    converted: 0,
  }
  const consultationMonth = Number(consultationDashboard.month || 0)
  const consultationConverted = Number(consultationDashboard.converted || 0)
  const consultationConversionRate =
    consultationMonth > 0 ? Math.round((consultationConverted / consultationMonth) * 100) : 0

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
    activity: {
      thisMonthCases: thisMonthCaseCount[0]?.count ?? 0,
      thisMonthMediations: thisMonthMediationCount[0]?.count ?? 0,
    },
    outstandingFees,
    consultations: {
      potential: potentialConsultationCount,
      byStatus: consultationStats,
      today: Number(consultationDashboard.today || 0),
      week: Number(consultationDashboard.week || 0),
      month: consultationMonth,
      converted: consultationConverted,
      conversionRate: consultationConversionRate,
      weeklyGoal: 5,
      monthlyGoal: 20,
      dailyGoal: 1,
    },
    criticalDeadlines,
  })
})

export default router
