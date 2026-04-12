import { Router } from 'express'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { caseHearings, cases, clients, collections, tasks } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const userId = req.user!.userId
  const now = new Date()
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [caseStats, upcomingHearings, pendingTasks, recentCases, totalCollections, outstandingFees] =
    await Promise.all([
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

      db
        .select({
          total: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
        })
        .from(collections)
        .innerJoin(cases, eq(collections.caseId, cases.id))
        .where(eq(cases.userId, userId)),

      db
        .select({
          id: cases.id,
          title: cases.title,
          clientName: clients.fullName,
          contractedFee: cases.contractedFee,
          totalCollected: sql<string>`COALESCE(SUM(${collections.amount}::numeric), 0)::text`,
          remaining: sql<string>`(${cases.contractedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0))::text`,
        })
        .from(cases)
        .leftJoin(clients, eq(cases.clientId, clients.id))
        .leftJoin(collections, eq(collections.caseId, cases.id))
        .where(
          and(
            eq(cases.userId, userId),
            sql`${cases.contractedFee} IS NOT NULL`,
            sql`${cases.contractedFee}::numeric > 0`,
            eq(cases.status, 'active')
          )
        )
        .groupBy(cases.id, cases.title, cases.contractedFee, clients.fullName)
        .having(sql`${cases.contractedFee}::numeric > COALESCE(SUM(${collections.amount}::numeric), 0)`)
        .orderBy(sql`${cases.contractedFee}::numeric - COALESCE(SUM(${collections.amount}::numeric), 0) DESC`)
        .limit(10),
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

  res.json({
    cases: caseCount,
    upcomingHearings,
    pendingTasks,
    recentCases,
    financials: {
      totalCollections: totalCollections[0]?.total ?? '0',
    },
    outstandingFees,
  })
})

export default router
