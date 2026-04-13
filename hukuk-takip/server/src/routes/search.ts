import { Router } from 'express'
import { ilike, or, eq, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, cases, tasks, caseHearings, mediationFiles, mediationParties } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

// GET /api/search?q=term
router.get('/', async (req, res) => {
  const q = (typeof req.query.q === 'string' ? req.query.q : '').trim()
  if (!q || q.length < 2) {
    res.json({ clients: [], cases: [], tasks: [], hearings: [], mediations: [] })
    return
  }

  const userId = (req as any).user.id
  const pattern = `%${q}%`

  const [foundClients, foundCases, foundTasks, foundHearings, foundMediations] = await Promise.all([
    // Clients
    db
      .select({
        id: clients.id,
        fullName: clients.fullName,
        phone: clients.phone,
        email: clients.email,
      })
      .from(clients)
      .where(
        or(
          ilike(clients.fullName, pattern),
          ilike(clients.phone, pattern),
          ilike(clients.email, pattern)
        )
      )
      .limit(5),

    // Cases
    db
      .select({
        id: cases.id,
        title: cases.title,
        caseNumber: cases.caseNumber,
        courtName: cases.courtName,
        status: cases.status,
        clientName: clients.fullName,
      })
      .from(cases)
      .leftJoin(clients, eq(cases.clientId, clients.id))
      .where(
        or(
          ilike(cases.title, pattern),
          ilike(cases.caseNumber, pattern),
          ilike(cases.courtName, pattern),
          ilike(cases.description, pattern),
          ilike(clients.fullName, pattern)
        )
      )
      .limit(5),

    // Tasks
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
      })
      .from(tasks)
      .where(
        or(
          ilike(tasks.title, pattern),
          ilike(tasks.description, pattern)
        )
      )
      .limit(5),

    // Hearings (join case for title)
    db
      .select({
        id: caseHearings.id,
        caseId: caseHearings.caseId,
        hearingDate: caseHearings.hearingDate,
        courtRoom: caseHearings.courtRoom,
        caseTitle: cases.title,
      })
      .from(caseHearings)
      .leftJoin(cases, eq(caseHearings.caseId, cases.id))
      .where(
        or(
          ilike(caseHearings.courtRoom, pattern),
          ilike(caseHearings.notes, pattern),
          ilike(cases.title, pattern)
        )
      )
      .orderBy(desc(caseHearings.hearingDate))
      .limit(5),

    // Mediation files + parties
    db
      .select({
        id: mediationFiles.id,
        fileNo: mediationFiles.fileNo,
        disputeType: mediationFiles.disputeType,
        disputeSubject: mediationFiles.disputeSubject,
        status: mediationFiles.status,
      })
      .from(mediationFiles)
      .where(
        or(
          ilike(mediationFiles.fileNo, pattern),
          ilike(mediationFiles.disputeType, pattern),
          ilike(mediationFiles.disputeSubject, pattern),
          ilike(mediationFiles.notes, pattern)
        )
      )
      .limit(5),
  ])

  res.json({
    clients: foundClients,
    cases: foundCases,
    tasks: foundTasks,
    hearings: foundHearings,
    mediations: foundMediations,
  })
})

export default router
