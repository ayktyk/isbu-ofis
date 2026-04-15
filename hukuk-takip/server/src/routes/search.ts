import { Router } from 'express'
import { and, ilike, or, eq, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  clients,
  cases,
  tasks,
  caseHearings,
  mediationFiles,
  mediationParties,
  consultations,
} from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

// GET /api/search?q=term
router.get('/', async (req, res) => {
  const q = (typeof req.query.q === 'string' ? req.query.q : '').trim()
  if (!q) {
    res.json({
      clients: [],
      cases: [],
      tasks: [],
      hearings: [],
      mediations: [],
      consultations: [],
    })
    return
  }

  const userId = req.user!.userId
  const pattern = `%${q}%`

  const [
    foundClients,
    foundCases,
    foundTasks,
    foundHearings,
    foundMediations,
    foundMediationsByParty,
    foundConsultations,
  ] = await Promise.all([
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
        and(
          eq(clients.userId, userId),
          or(
            ilike(clients.fullName, pattern),
            ilike(clients.phone, pattern),
            ilike(clients.email, pattern),
            ilike(clients.tcNo, pattern),
            ilike(clients.address, pattern),
            ilike(clients.notes, pattern)
          )
        )
      )
      .limit(10),

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
        and(
          eq(cases.userId, userId),
          or(
            ilike(cases.title, pattern),
            ilike(cases.caseNumber, pattern),
            ilike(cases.courtName, pattern),
            ilike(cases.description, pattern),
            ilike(clients.fullName, pattern)
          )
        )
      )
      .limit(10),

    // Tasks
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        caseId: tasks.caseId,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          or(ilike(tasks.title, pattern), ilike(tasks.description, pattern))
        )
      )
      .limit(10),

    // Hearings (filter via case.userId)
    db
      .select({
        id: caseHearings.id,
        caseId: caseHearings.caseId,
        hearingDate: caseHearings.hearingDate,
        courtRoom: caseHearings.courtRoom,
        caseTitle: cases.title,
      })
      .from(caseHearings)
      .innerJoin(cases, eq(caseHearings.caseId, cases.id))
      .where(
        and(
          eq(cases.userId, userId),
          or(
            ilike(caseHearings.courtRoom, pattern),
            ilike(caseHearings.notes, pattern),
            ilike(cases.title, pattern),
            ilike(cases.caseNumber, pattern)
          )
        )
      )
      .orderBy(desc(caseHearings.hearingDate))
      .limit(10),

    // Mediation files (direct fields)
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
        and(
          eq(mediationFiles.userId, userId),
          or(
            ilike(mediationFiles.fileNo, pattern),
            ilike(mediationFiles.disputeType, pattern),
            ilike(mediationFiles.disputeSubject, pattern),
            ilike(mediationFiles.notes, pattern)
          )
        )
      )
      .limit(10),

    // Mediation files via party search
    db
      .select({
        id: mediationFiles.id,
        fileNo: mediationFiles.fileNo,
        disputeType: mediationFiles.disputeType,
        disputeSubject: mediationFiles.disputeSubject,
        status: mediationFiles.status,
      })
      .from(mediationParties)
      .innerJoin(mediationFiles, eq(mediationParties.mediationFileId, mediationFiles.id))
      .where(
        and(
          eq(mediationFiles.userId, userId),
          or(
            ilike(mediationParties.fullName, pattern),
            ilike(mediationParties.tcNo, pattern),
            ilike(mediationParties.phone, pattern),
            ilike(mediationParties.email, pattern),
            ilike(mediationParties.lawyerName, pattern),
            ilike(mediationParties.lawyerBarNo, pattern),
            ilike(mediationParties.lawyerPhone, pattern)
          )
        )
      )
      .limit(10),

    // Consultations
    db
      .select({
        id: consultations.id,
        fullName: consultations.fullName,
        phone: consultations.phone,
        subject: consultations.subject,
        status: consultations.status,
        consultationDate: consultations.consultationDate,
      })
      .from(consultations)
      .where(
        and(
          eq(consultations.userId, userId),
          or(
            ilike(consultations.fullName, pattern),
            ilike(consultations.phone, pattern),
            ilike(consultations.subject, pattern),
            ilike(consultations.notes, pattern),
            ilike(consultations.sourceDetail, pattern)
          )
        )
      )
      .limit(10),
  ])

  // Merge mediations by id (deduplicate)
  const mediationMap = new Map<string, (typeof foundMediations)[number]>()
  for (const m of [...foundMediations, ...foundMediationsByParty]) {
    mediationMap.set(m.id, m)
  }

  res.json({
    clients: foundClients,
    cases: foundCases,
    tasks: foundTasks,
    hearings: foundHearings,
    mediations: Array.from(mediationMap.values()).slice(0, 10),
    consultations: foundConsultations,
  })
})

export default router
