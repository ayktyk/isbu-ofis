import { Router } from 'express'
import { and, eq, desc, sql, type SQL } from 'drizzle-orm'
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
import type { AnyColumn } from 'drizzle-orm'

const router = Router()

router.use(authenticate)

// unaccent extension kurulu mu? Startup'ta ensureSchema dener; kurulamazsa
// buradaki tespit bunu yakalayıp lower()+ilike fallback'ine düşer.
let unaccentAvailable: boolean | null = null

async function detectUnaccent(): Promise<boolean> {
  if (unaccentAvailable !== null) return unaccentAvailable
  try {
    const rows = await db.execute(sql`SELECT unaccent('test') as x`)
    unaccentAvailable = Array.isArray(rows) ? rows.length >= 0 : true
  } catch {
    unaccentAvailable = false
  }
  return unaccentAvailable
}

// Tek noktadan case-insensitive + diacritic-insensitive LIKE üretir.
// unaccent varsa: unaccent(lower(col)) LIKE unaccent(lower(pattern))
// yoksa:         lower(col) LIKE lower(pattern) (Turkce I/i yine tolerablidir)
function buildMatch(col: AnyColumn, pattern: string, useUnaccent: boolean): SQL {
  if (useUnaccent) {
    return sql`unaccent(lower(${col}::text)) LIKE unaccent(lower(${pattern}))`
  }
  return sql`lower(${col}::text) LIKE lower(${pattern})`
}

function anyOf(parts: SQL[]): SQL {
  // drizzle or() yerine sql raw ile birleştirme — heterojen SQL listelerinde
  // tip uyumu sorunu olmaz.
  if (parts.length === 0) return sql`FALSE`
  if (parts.length === 1) return parts[0]
  return sql.join(parts, sql` OR `)
}

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
  const useUnaccent = await detectUnaccent()

  const m = (col: AnyColumn) => buildMatch(col, pattern, useUnaccent)

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
          anyOf([
            m(clients.fullName),
            m(clients.phone),
            m(clients.email),
            m(clients.tcNo),
            m(clients.address),
            m(clients.notes),
          ])
        )
      )
      .limit(15),

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
          anyOf([
            m(cases.title),
            m(cases.caseNumber),
            m(cases.courtName),
            m(cases.description),
            m(clients.fullName),
          ])
        )
      )
      .limit(15),

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
          anyOf([m(tasks.title), m(tasks.description), m(tasks.label)])
        )
      )
      .limit(15),

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
          anyOf([
            m(caseHearings.courtRoom),
            m(caseHearings.notes),
            m(cases.title),
            m(cases.caseNumber),
          ])
        )
      )
      .orderBy(desc(caseHearings.hearingDate))
      .limit(15),

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
          anyOf([
            m(mediationFiles.fileNo),
            m(mediationFiles.disputeType),
            m(mediationFiles.disputeSubject),
            m(mediationFiles.notes),
          ])
        )
      )
      .limit(15),

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
          anyOf([
            m(mediationParties.fullName),
            m(mediationParties.tcNo),
            m(mediationParties.phone),
            m(mediationParties.email),
            m(mediationParties.lawyerName),
            m(mediationParties.lawyerBarNo),
            m(mediationParties.lawyerPhone),
          ])
        )
      )
      .limit(15),

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
          anyOf([
            m(consultations.fullName),
            m(consultations.phone),
            m(consultations.subject),
            m(consultations.notes),
            m(consultations.sourceDetail),
          ])
        )
      )
      .limit(15),
  ])

  // Merge mediations by id (deduplicate)
  const mediationMap = new Map<string, (typeof foundMediations)[number]>()
  for (const med of [...foundMediations, ...foundMediationsByParty]) {
    mediationMap.set(med.id, med)
  }

  res.json({
    clients: foundClients,
    cases: foundCases,
    tasks: foundTasks,
    hearings: foundHearings,
    mediations: Array.from(mediationMap.values()).slice(0, 15),
    consultations: foundConsultations,
  })
})

export default router
