import { Router } from 'express'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { cases, collections, clients, mediationFiles } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import {
  getOutstandingCaseFees,
  getOutstandingMediationFees,
  sumOutstanding,
} from '../utils/outstandingFees.js'

const router = Router()
router.use(authenticate)

const TR_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${TR_MONTHS[parseInt(m, 10) - 1]} ${y}`
}

function fillMonths<T extends { month: string }>(
  data: T[],
  defaultVal: Record<string, unknown>
): Array<T & { label: string }> {
  const now = new Date()
  const months: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const map = new Map(data.map((d) => [d.month, { ...d, label: monthLabel(d.month) }]))
  return months.map(
    (m) =>
      map.get(m) ??
      ({ month: m, label: monthLabel(m), ...defaultVal } as unknown as T & { label: string })
  )
}

const CASE_TYPE_LABELS: Record<string, string> = {
  iscilik_alacagi: 'İşçilik Alacağı',
  bosanma: 'Boşanma',
  velayet: 'Velayet',
  mal_paylasimi: 'Mal Paylaşımı',
  kira: 'Kira',
  tuketici: 'Tüketici',
  icra: 'İcra',
  ceza: 'Ceza',
  idare: 'İdare',
  diger: 'Diğer',
}

// Client tarafındaki caseStatusLabels (lib/utils.ts) ile birebir aynı —
// "passive" istemcide "Potansiyel" anlamında kullanılıyor (pasif dosyalar +
// potansiyel görüşmeler). İki ucun ayrı çevirisi tutarsızlık yaratıyordu.
const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  istinafta: 'İstinafta',
  'yargıtayda': 'Yargıtayda',
  passive: 'Potansiyel',
  won: 'Kazanıldı',
  lost: 'Kaybedildi',
  settled: 'Uzlaşıldı',
  closed: 'Kapatıldı',
}

router.get('/', async (req, res) => {
  const userId = req.user!.userId

  const [
    monthlyCasesRaw,
    monthlyCaseCollectionsRaw,
    monthlyMediationCollectionsRaw,
    monthlyMediationsRaw,
    casesByType,
    casesByStatus,
    expectedFromCases,
    expectedFromMediations,
    allTimeCaseIncomeRaw,
    allTimeMediationIncomeRaw,
    allTimeCmkIncomeRaw,
    monthlyCmkCollectionsRaw,
    cmkActiveCountRaw,
    monthlyCmkCasesRaw,
    cmkExpectedRaw,
  ] = await Promise.all([
    // monthlyCases
    db
      .select({
        month: sql<string>`TO_CHAR(${cases.createdAt}, 'YYYY-MM')`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(cases)
      .where(
        sql`${cases.userId} = ${userId} AND ${cases.archivedAt} IS NULL AND ${cases.createdAt} >= NOW() - INTERVAL '12 months'`
      )
      .groupBy(sql`TO_CHAR(${cases.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${cases.createdAt}, 'YYYY-MM')`),

    // monthlyCaseCollections — sadece dava tahsilatları
    db
      .select({
        month: sql<string>`TO_CHAR(${collections.collectionDate}, 'YYYY-MM')`,
        amount: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
      })
      .from(collections)
      .innerJoin(cases, eq(collections.caseId, cases.id))
      .where(
        sql`${cases.userId} = ${userId} AND ${cases.archivedAt} IS NULL AND ${collections.archivedAt} IS NULL AND ${collections.collectionDate}::date >= NOW() - INTERVAL '12 months' AND ${collections.caseId} IS NOT NULL`
      )
      .groupBy(sql`TO_CHAR(${collections.collectionDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${collections.collectionDate}, 'YYYY-MM')`),

    // monthlyMediationCollections — arabuluculuk tahsilatları
    db
      .select({
        month: sql<string>`TO_CHAR(${collections.collectionDate}, 'YYYY-MM')`,
        amount: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
      })
      .from(collections)
      .innerJoin(mediationFiles, eq(collections.mediationFileId, mediationFiles.id))
      .where(
        sql`${mediationFiles.userId} = ${userId} AND ${mediationFiles.archivedAt} IS NULL AND ${collections.archivedAt} IS NULL AND ${collections.collectionDate}::date >= NOW() - INTERVAL '12 months' AND ${collections.mediationFileId} IS NOT NULL`
      )
      .groupBy(sql`TO_CHAR(${collections.collectionDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${collections.collectionDate}, 'YYYY-MM')`),

    // monthlyMediations — dosya sayısı (mevcut, korunuyor)
    db
      .select({
        month: sql<string>`TO_CHAR(${mediationFiles.createdAt}, 'YYYY-MM')`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(mediationFiles)
      .where(
        sql`${mediationFiles.userId} = ${userId} AND ${mediationFiles.archivedAt} IS NULL AND ${mediationFiles.createdAt} >= NOW() - INTERVAL '12 months'`
      )
      .groupBy(sql`TO_CHAR(${mediationFiles.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${mediationFiles.createdAt}, 'YYYY-MM')`),

    // casesByType
    db
      .select({
        type: cases.caseType,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(cases)
      .where(and(eq(cases.userId, userId), isNull(cases.archivedAt)))
      .groupBy(cases.caseType)
      .orderBy(sql`COUNT(*) DESC`),

    // casesByStatus
    db
      .select({
        status: cases.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(cases)
      .where(and(eq(cases.userId, userId), isNull(cases.archivedAt)))
      .groupBy(cases.status)
      .orderBy(sql`COUNT(*) DESC`),

    // expectedFromCases — tek kaynak: outstandingFees helper. Dashboard widget'ı
    // ile aynı filtre/order; iki ekran arasındaki tutarsızlık burada elenir.
    getOutstandingCaseFees(userId),

    // expectedFromMediations — tek kaynak: outstandingFees helper.
    getOutstandingMediationFees(userId),

    // allTimeCaseIncome — tüm zaman tahsilat toplamı (sadece dava bağlı tahsilatlar)
    db
      .select({
        amount: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
      })
      .from(collections)
      .innerJoin(cases, eq(collections.caseId, cases.id))
      .where(
        sql`${cases.userId} = ${userId} AND ${cases.archivedAt} IS NULL AND ${collections.archivedAt} IS NULL AND ${collections.caseId} IS NOT NULL`
      ),

    // allTimeMediationIncome
    db
      .select({
        amount: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
      })
      .from(collections)
      .innerJoin(mediationFiles, eq(collections.mediationFileId, mediationFiles.id))
      .where(
        sql`${mediationFiles.userId} = ${userId} AND ${mediationFiles.archivedAt} IS NULL AND ${collections.archivedAt} IS NULL AND ${collections.mediationFileId} IS NOT NULL`
      ),

    // allTimeCmkIncome — sadece CMK görevlendirmesi olan davalardan tahsilat
    db
      .select({
        amount: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
      })
      .from(collections)
      .innerJoin(cases, eq(collections.caseId, cases.id))
      .where(
        sql`${cases.userId} = ${userId} AND ${cases.archivedAt} IS NULL AND ${cases.isCmkAssignment} = true AND ${collections.archivedAt} IS NULL AND ${collections.caseId} IS NOT NULL`
      ),

    // monthlyCmkCollections — son 12 ay CMK aylık
    db
      .select({
        month: sql<string>`TO_CHAR(${collections.collectionDate}, 'YYYY-MM')`,
        amount: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
      })
      .from(collections)
      .innerJoin(cases, eq(collections.caseId, cases.id))
      .where(
        sql`${cases.userId} = ${userId} AND ${cases.archivedAt} IS NULL AND ${cases.isCmkAssignment} = true AND ${collections.archivedAt} IS NULL AND ${collections.collectionDate}::date >= NOW() - INTERVAL '12 months' AND ${collections.caseId} IS NOT NULL`
      )
      .groupBy(sql`TO_CHAR(${collections.collectionDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${collections.collectionDate}, 'YYYY-MM')`),

    // cmkActiveCount — aktif CMK görevlendirme sayısı
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(cases)
      .where(
        sql`${cases.userId} = ${userId} AND ${cases.archivedAt} IS NULL AND ${cases.isCmkAssignment} = true`
      ),

    // monthlyCmkCases — son 12 ay her ay açılan CMK görevlendirme sayısı.
    // İstatistikler sayfasındaki "Aylık Dosya Sayısı" grafiğinde CMK
    // serisini ayrı bar olarak çizmek için kullanılır. monthlyCases zaten
    // tüm davaları (CMK dahil) içerdiği için burada sadece CMK alt kümesi
    // sayılır.
    db
      .select({
        month: sql<string>`TO_CHAR(${cases.createdAt}, 'YYYY-MM')`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(cases)
      .where(
        sql`${cases.userId} = ${userId} AND ${cases.archivedAt} IS NULL AND ${cases.isCmkAssignment} = true AND ${cases.createdAt} >= NOW() - INTERVAL '12 months'`
      )
      .groupBy(sql`TO_CHAR(${cases.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${cases.createdAt}, 'YYYY-MM')`),

    // cmkExpected — tek kaynak: helper'dan CMK'ya filtrelenmiş bekleyen liste.
    // Toplam burada sum edilir; Dashboard'daki bekleyen widget toplamıyla
    // tutarlı çalışsın diye aynı sorgu üzerinden gelir.
    getOutstandingCaseFees(userId, { cmk: 'only' }),
  ])

  // Fill empty months and add labels
  const monthlyCases = fillMonths(monthlyCasesRaw, { count: 0 })
  const monthlyMediations = fillMonths(monthlyMediationsRaw, { count: 0 })

  // monthlyIncome: dava + arabuluculuk kırılımı tek seride
  const caseMap = new Map(monthlyCaseCollectionsRaw.map((r) => [r.month, r.amount]))
  const medMap = new Map(monthlyMediationCollectionsRaw.map((r) => [r.month, r.amount]))

  const now = new Date()
  const monthKeys: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const monthlyIncome = monthKeys.map((m) => {
    const caseAmount = parseFloat(caseMap.get(m) || '0')
    const mediationAmount = parseFloat(medMap.get(m) || '0')
    return {
      month: m,
      label: monthLabel(m),
      caseAmount: caseAmount.toFixed(2),
      mediationAmount: mediationAmount.toFixed(2),
      total: (caseAmount + mediationAmount).toFixed(2),
    }
  })

  // Geriye uyum için monthlyCollections (sadece dava) de tutalım — UI henüz geçmemişse kırılmasın
  const monthlyCollections = monthlyIncome.map((r) => ({
    month: r.month,
    label: r.label,
    amount: r.caseAmount,
  }))

  const casesByTypeLabeled = casesByType.map((r) => ({
    ...r,
    label: CASE_TYPE_LABELS[r.type] || r.type,
  }))

  const casesByStatusLabeled = casesByStatus.map((r) => ({
    ...r,
    label: STATUS_LABELS[r.status] || r.status,
  }))

  // Totals — all-time (12 ay grafiği aynı kalıyor; özet kartlar tüm zaman)
  const totalCases = casesByStatus.reduce((sum, r) => sum + r.count, 0)
  const totalMediations = monthlyMediationsRaw.reduce((sum, r) => sum + r.count, 0)
  const totalCaseIncome = parseFloat(allTimeCaseIncomeRaw[0]?.amount || '0')
  const totalMediationIncome = parseFloat(allTimeMediationIncomeRaw[0]?.amount || '0')
  const totalCollected = totalCaseIncome + totalMediationIncome

  // totalExpected: düzgün hesap — tüm bekleyen kalemlerin toplamı.
  // expectedFromCases ve expectedFromMediations helper'dan tipli geldiği için
  // burada UI'ın eski `caseId` alanına uyumlu olacak şekilde normalize ediyoruz.
  const normalizedExpectedFromCases = expectedFromCases.map((row) => ({
    caseId: row.id,
    title: row.title,
    clientName: row.clientName,
    contractedFee: row.contractedFee,
    collected: row.totalCollected,
    remaining: row.remaining,
    source: row.source,
    isCmkAssignment: row.isCmkAssignment,
    createdAt: row.createdAt,
  }))
  const normalizedExpectedFromMediations = expectedFromMediations.map((row) => ({
    caseId: row.id,
    title: row.title,
    clientName: row.clientName,
    contractedFee: row.contractedFee,
    collected: row.totalCollected,
    remaining: row.remaining,
    source: row.source,
    createdAt: row.createdAt,
  }))
  // Sıralama: en yeni eklenen üstte (avukatın yeni eklediği davalar büyük tutarlı
  // eski davaların altına düşmesin). createdAt yoksa fallback olarak remaining DESC.
  const expectedCollections = [
    ...normalizedExpectedFromCases,
    ...normalizedExpectedFromMediations,
  ].sort((a, b) => {
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0
    if (aDate !== bDate) return bDate - aDate
    return parseFloat(b.remaining || '0') - parseFloat(a.remaining || '0')
  })
  const totalExpected = expectedCollections.reduce(
    (s, r) => s + parseFloat(r.remaining || '0'),
    0,
  )

  const grossTarget = totalCollected + totalExpected
  const collectionRate = grossTarget > 0 ? Math.round((totalCollected / grossTarget) * 10000) / 100 : 0

  // Bu ay
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonth = monthlyIncome.find((r) => r.month === currentMonthKey)
  const thisMonthCaseIncome = thisMonth?.caseAmount ?? '0.00'
  const thisMonthMediationIncome = thisMonth?.mediationAmount ?? '0.00'
  const thisMonthTotal = thisMonth?.total ?? '0.00'

  // CMK metrikleri — toplam, bu ay, aktif sayısı, bekleyen.
  // cmkExpectedRaw artık helper'dan satır listesi olarak geliyor — sumOutstanding ile
  // toplanır. Bu rakam Dashboard'da CMK rozetli davaların toplamıyla aynı olur.
  const cmkMap = new Map(monthlyCmkCollectionsRaw.map((r) => [r.month, r.amount]))
  const totalCmkIncome = parseFloat(allTimeCmkIncomeRaw[0]?.amount || '0')
  const thisMonthCmkIncome = parseFloat(cmkMap.get(currentMonthKey) || '0')
  const cmkActiveCount = cmkActiveCountRaw[0]?.count ?? 0
  const cmkExpected = sumOutstanding(cmkExpectedRaw)

  const monthlyCmkIncome = monthKeys.map((m) => ({
    month: m,
    label: monthLabel(m),
    amount: parseFloat(cmkMap.get(m) || '0').toFixed(2),
  }))

  // CMK aylık dosya sayısı — "Aylık Dosya Sayısı" grafiğinde Davalar /
  // Arabuluculuk / CMK üç ayrı bar olarak çizilebilsin diye 12 aylık seri.
  // monthlyCases zaten CMK dahil toplamı verdiği için burada sadece CMK
  // alt kümesi sayılıyor; istemcide kullanıcı dilerse Davalar - CMK
  // farkını alır ya da olduğu gibi gösterir.
  const cmkCaseCountMap = new Map(monthlyCmkCasesRaw.map((r) => [r.month, r.count]))
  const monthlyCmkCases = monthKeys.map((m) => ({
    month: m,
    label: monthLabel(m),
    count: cmkCaseCountMap.get(m) ?? 0,
  }))

  res.json({
    monthlyCases,
    monthlyCollections, // backward compat
    monthlyIncome,       // yeni: caseAmount + mediationAmount + total
    monthlyMediations,
    casesByType: casesByTypeLabeled,
    casesByStatus: casesByStatusLabeled,
    expectedCollections,
    totals: {
      totalCases,
      totalMediations,
      totalCollected: totalCollected.toFixed(2),
      totalExpected: totalExpected.toFixed(2),
      totalCaseIncome: totalCaseIncome.toFixed(2),
      totalMediationIncome: totalMediationIncome.toFixed(2),
      thisMonthCaseIncome,
      thisMonthMediationIncome,
      thisMonthTotal,
      collectionRate,
      // CMK ayrık metrikleri
      totalCmkIncome: totalCmkIncome.toFixed(2),
      thisMonthCmkIncome: thisMonthCmkIncome.toFixed(2),
      cmkActiveCount,
      cmkExpected: cmkExpected.toFixed(2),
    },
    monthlyCmkIncome,
    monthlyCmkCases,
  })
})

export default router
