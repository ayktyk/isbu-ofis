import { Router } from 'express'
import { and, eq, or, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { cases, collections, clients, mediationFiles } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'

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

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  istinafta: 'İstinafta',
  'yargıtayda': 'Yargıtayda',
  passive: 'Pasif',
  won: 'Kazanıldı',
  lost: 'Kaybedildi',
  settled: 'Uzlaşma',
  closed: 'Kapandı',
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
  ] = await Promise.all([
    // monthlyCases
    db
      .select({
        month: sql<string>`TO_CHAR(${cases.createdAt}, 'YYYY-MM')`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(cases)
      .where(
        sql`${cases.userId} = ${userId} AND ${cases.createdAt} >= NOW() - INTERVAL '12 months'`
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
        sql`${cases.userId} = ${userId} AND ${collections.collectionDate}::date >= NOW() - INTERVAL '12 months' AND ${collections.caseId} IS NOT NULL`
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
        sql`${mediationFiles.userId} = ${userId} AND ${collections.collectionDate}::date >= NOW() - INTERVAL '12 months' AND ${collections.mediationFileId} IS NOT NULL`
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
        sql`${mediationFiles.userId} = ${userId} AND ${mediationFiles.createdAt} >= NOW() - INTERVAL '12 months'`
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
      .where(eq(cases.userId, userId))
      .groupBy(cases.caseType)
      .orderBy(sql`COUNT(*) DESC`),

    // casesByStatus
    db
      .select({
        status: cases.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(cases)
      .where(eq(cases.userId, userId))
      .groupBy(cases.status)
      .orderBy(sql`COUNT(*) DESC`),

    // expectedFromCases — davalardan bekleyen
    db
      .select({
        caseId: cases.id,
        title: cases.title,
        clientName: clients.fullName,
        contractedFee: cases.contractedFee,
        collected: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
        remaining: sql<string>`(${cases.contractedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0))::text`,
        source: sql<string>`'case'`,
      })
      .from(cases)
      .leftJoin(clients, eq(cases.clientId, clients.id))
      .leftJoin(collections, eq(collections.caseId, cases.id))
      .where(
        sql`${cases.userId} = ${userId} AND ${cases.contractedFee} IS NOT NULL AND ${cases.contractedFee}::numeric > 0`
      )
      .groupBy(cases.id, cases.title, clients.fullName, cases.contractedFee)
      .having(
        sql`${cases.contractedFee}::numeric > COALESCE(SUM(${collections.amount}::numeric), 0)`
      )
      .orderBy(
        sql`(${cases.contractedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0)) DESC`
      )
      .limit(20),

    // expectedFromMediations — arabuluculuktan bekleyen
    db
      .select({
        caseId: mediationFiles.id,
        title: sql<string>`COALESCE(${mediationFiles.fileNo}, ${mediationFiles.disputeType})`,
        clientName: sql<string>`${mediationFiles.disputeType}`,
        contractedFee: mediationFiles.agreedFee,
        collected: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
        remaining: sql<string>`(${mediationFiles.agreedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0))::text`,
        source: sql<string>`'mediation'`,
      })
      .from(mediationFiles)
      .leftJoin(collections, eq(collections.mediationFileId, mediationFiles.id))
      .where(
        sql`${mediationFiles.userId} = ${userId} AND ${mediationFiles.agreedFee} IS NOT NULL AND ${mediationFiles.agreedFee}::numeric > 0 AND ${mediationFiles.status} = 'active'`
      )
      .groupBy(mediationFiles.id, mediationFiles.fileNo, mediationFiles.disputeType, mediationFiles.agreedFee)
      .having(
        sql`${mediationFiles.agreedFee}::numeric > COALESCE(SUM(${collections.amount}::numeric), 0)`
      )
      .orderBy(
        sql`(${mediationFiles.agreedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0)) DESC`
      )
      .limit(20),
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

  // Totals
  const totalCases = casesByStatus.reduce((sum, r) => sum + r.count, 0)
  const totalMediations = monthlyMediationsRaw.reduce((sum, r) => sum + r.count, 0)
  const totalCaseIncome = monthlyIncome.reduce((s, r) => s + parseFloat(r.caseAmount), 0)
  const totalMediationIncome = monthlyIncome.reduce((s, r) => s + parseFloat(r.mediationAmount), 0)
  const totalCollected = totalCaseIncome + totalMediationIncome

  // totalExpected: düzgün hesap — tüm bekleyen kalemlerin toplamı
  const expectedCollections = [...expectedFromCases, ...expectedFromMediations].sort(
    (a, b) => parseFloat(b.remaining || '0') - parseFloat(a.remaining || '0')
  )
  const totalExpected = expectedCollections.reduce((s, r) => s + parseFloat(r.remaining || '0'), 0)

  const grossTarget = totalCollected + totalExpected
  const collectionRate = grossTarget > 0 ? Math.round((totalCollected / grossTarget) * 10000) / 100 : 0

  // Bu ay
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonth = monthlyIncome.find((r) => r.month === currentMonthKey)
  const thisMonthCaseIncome = thisMonth?.caseAmount ?? '0.00'
  const thisMonthMediationIncome = thisMonth?.mediationAmount ?? '0.00'
  const thisMonthTotal = thisMonth?.total ?? '0.00'

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
    },
  })
})

export default router
