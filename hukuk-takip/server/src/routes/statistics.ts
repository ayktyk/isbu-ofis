import { Router } from 'express'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { cases, collections, clients, mediationFiles } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

const TR_MONTHS = [
  'Ocak',
  'Subat',
  'Mart',
  'Nisan',
  'Mayis',
  'Haziran',
  'Temmuz',
  'Agustos',
  'Eylul',
  'Ekim',
  'Kasim',
  'Aralik',
]

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${TR_MONTHS[parseInt(m, 10) - 1]} ${y}`
}

function fillMonths(
  data: { month: string }[],
  defaultVal: Record<string, unknown>
): { month: string; label: string; [key: string]: unknown }[] {
  const now = new Date()
  const months: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const map = new Map(data.map((d) => [d.month, d]))
  return months.map(
    (m) => (map.get(m) as { month: string; label: string; [key: string]: unknown }) || { month: m, label: monthLabel(m), ...defaultVal }
  )
}

const CASE_TYPE_LABELS: Record<string, string> = {
  iscilik_alacagi: 'Iscilik Alacagi',
  bosanma: 'Bosanma',
  velayet: 'Velayet',
  mal_paylasimi: 'Mal Paylasimi',
  kira: 'Kira',
  tuketici: 'Tuketici',
  icra: 'Icra',
  ceza: 'Ceza',
  idare: 'Idare',
  diger: 'Diger',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  istinafta: 'Istinafta',
  'yargıtayda': 'Yargitayda',
  passive: 'Pasif',
  won: 'Kazanildi',
  lost: 'Kaybedildi',
  settled: 'Uzlasma',
  closed: 'Kapandi',
}

router.get('/', async (req, res) => {
  const userId = req.user!.userId

  const [
    monthlyCasesRaw,
    monthlyCollectionsRaw,
    monthlyMediationsRaw,
    casesByType,
    casesByStatus,
    expectedCollections,
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

    // monthlyCollections
    db
      .select({
        month: sql<string>`TO_CHAR(${collections.collectionDate}, 'YYYY-MM')`,
        amount: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
      })
      .from(collections)
      .innerJoin(cases, eq(collections.caseId, cases.id))
      .where(
        sql`${cases.userId} = ${userId} AND ${collections.collectionDate}::date >= NOW() - INTERVAL '12 months'`
      )
      .groupBy(sql`TO_CHAR(${collections.collectionDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${collections.collectionDate}, 'YYYY-MM')`),

    // monthlyMediations
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

    // expectedCollections
    db
      .select({
        caseId: cases.id,
        title: cases.title,
        clientName: clients.fullName,
        contractedFee: cases.contractedFee,
        collected: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
        remaining: sql<string>`(${cases.contractedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0))::text`,
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
  ])

  // Fill empty months and add labels
  const monthlyCases = fillMonths(
    monthlyCasesRaw.map((r) => ({ ...r, label: monthLabel(r.month) })),
    { count: 0 }
  )

  const monthlyCollections = fillMonths(
    monthlyCollectionsRaw.map((r) => ({ ...r, label: monthLabel(r.month) })),
    { amount: '0' }
  )

  const monthlyMediations = fillMonths(
    monthlyMediationsRaw.map((r) => ({ ...r, label: monthLabel(r.month) })),
    { count: 0 }
  )

  const casesByTypeLabeled = casesByType.map((r) => ({
    ...r,
    label: CASE_TYPE_LABELS[r.type] || r.type,
  }))

  const casesByStatusLabeled = casesByStatus.map((r) => ({
    ...r,
    label: STATUS_LABELS[r.status] || r.status,
  }))

  // Compute totals
  const totalCases = casesByStatus.reduce((sum, r) => sum + r.count, 0)
  const totalMediations = monthlyMediationsRaw.reduce((sum, r) => sum + r.count, 0)
  const totalCollected = monthlyCollectionsRaw.reduce(
    (sum, r) => sum + parseFloat(r.amount || '0'),
    0
  )
  const totalExpected = expectedCollections.reduce(
    (sum, r) => sum + parseFloat(r.remaining || '0'),
    0
  ) + totalCollected

  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 10000) / 100 : 0

  res.json({
    monthlyCases,
    monthlyCollections,
    monthlyMediations,
    casesByType: casesByTypeLabeled,
    casesByStatus: casesByStatusLabeled,
    expectedCollections,
    totals: {
      totalCases,
      totalMediations,
      totalCollected: totalCollected.toFixed(2),
      totalExpected: totalExpected.toFixed(2),
      collectionRate,
    },
  })
})

export default router
