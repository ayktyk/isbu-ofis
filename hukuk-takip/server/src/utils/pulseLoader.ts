// Dosya nabzı için salt-okunur veri toplama. Hesap shared/casePulse.ts'te (saf).
import { and, eq, inArray, isNull, ne } from 'drizzle-orm'
import { computeCasePulse, type CasePulseItem } from '@hukuk-takip/shared'
import { db } from '../db/index.js'
import {
  caseDiaryEntries,
  caseFeeInstallments,
  caseHearings,
  cases,
  caseWorkspaces,
  clients,
  collections,
  mediationFiles,
  tasks,
} from '../db/schema.js'

export async function loadCasePulse(userId: string, now = new Date()): Promise<CasePulseItem[]> {
  const caseRows = await db
    .select({
      id: cases.id, title: cases.title, status: cases.status, isCmkAssignment: cases.isCmkAssignment,
      caseNumber: cases.caseNumber, courtName: cases.courtName, buroKodu: cases.buroKodu,
      clientName: clients.fullName, contractedFee: cases.contractedFee,
      createdAt: cases.createdAt, updatedAt: cases.updatedAt,
    })
    .from(cases)
    .leftJoin(clients, eq(cases.clientId, clients.id))
    .where(and(eq(cases.userId, userId), isNull(cases.archivedAt), ne(cases.status, 'closed')))
  const mediationRows = await db
    .select({ id: mediationFiles.id, fileNo: mediationFiles.fileNo, disputeType: mediationFiles.disputeType, status: mediationFiles.status, agreedFee: mediationFiles.agreedFee, createdAt: mediationFiles.createdAt, updatedAt: mediationFiles.updatedAt })
    .from(mediationFiles)
    .where(and(eq(mediationFiles.userId, userId), isNull(mediationFiles.archivedAt), eq(mediationFiles.status, 'active')))

  const caseIds = caseRows.map((c) => c.id)
  const mediationIds = mediationRows.map((m) => m.id)
  const none = caseIds.length === 0

  const [hearingRows, taskRows, diaryRows, workspaceRows, collectionRows, installmentRows, mediationCollections] = await Promise.all([
    none ? [] : db.select({ id: caseHearings.id, caseId: caseHearings.caseId, hearingDate: caseHearings.hearingDate, result: caseHearings.result })
      .from(caseHearings).where(and(inArray(caseHearings.caseId, caseIds), isNull(caseHearings.archivedAt))),
    none ? [] : db.select({ id: tasks.id, caseId: tasks.caseId, title: tasks.title, status: tasks.status, dueDate: tasks.dueDate, isDeadline: tasks.isDeadline, createdAt: tasks.createdAt, updatedAt: tasks.updatedAt, completedAt: tasks.completedAt })
      .from(tasks).where(and(eq(tasks.userId, userId), inArray(tasks.caseId, caseIds), isNull(tasks.archivedAt))),
    none ? [] : db.select({ id: caseDiaryEntries.id, caseId: caseDiaryEntries.caseId, occurredAt: caseDiaryEntries.occurredAt, nextStep: caseDiaryEntries.nextStep, nextStepDone: caseDiaryEntries.nextStepDone, nextStepDueDate: caseDiaryEntries.nextStepDueDate })
      .from(caseDiaryEntries).where(and(inArray(caseDiaryEntries.caseId, caseIds), isNull(caseDiaryEntries.archivedAt))),
    none ? [] : db.select({ caseId: caseWorkspaces.caseId, waitingFor: caseWorkspaces.waitingFor, checkDate: caseWorkspaces.checkDate, stage: caseWorkspaces.stage })
      .from(caseWorkspaces).where(inArray(caseWorkspaces.caseId, caseIds)),
    none ? [] : db.select({ caseId: collections.caseId, mediationFileId: collections.mediationFileId, amount: collections.amount, collectionDate: collections.collectionDate })
      .from(collections).where(and(inArray(collections.caseId, caseIds), isNull(collections.archivedAt))),
    none ? [] : db.select({ caseId: caseFeeInstallments.caseId, amount: caseFeeInstallments.amount, dueDate: caseFeeInstallments.dueDate, status: caseFeeInstallments.status })
      .from(caseFeeInstallments).where(and(inArray(caseFeeInstallments.caseId, caseIds), isNull(caseFeeInstallments.archivedAt))),
    mediationIds.length === 0 ? [] : db.select({ caseId: collections.caseId, mediationFileId: collections.mediationFileId, amount: collections.amount, collectionDate: collections.collectionDate })
      .from(collections).where(and(inArray(collections.mediationFileId, mediationIds), isNull(collections.archivedAt))),
  ])

  return computeCasePulse({
    cases: caseRows,
    mediationFiles: mediationRows.map((m) => ({ id: m.id, title: m.fileNo || m.disputeType, status: m.status, agreedFee: m.agreedFee, createdAt: m.createdAt, updatedAt: m.updatedAt })),
    hearings: hearingRows,
    tasks: taskRows,
    diary: diaryRows,
    workspaces: workspaceRows,
    collections: [...collectionRows, ...mediationCollections],
    installments: installmentRows,
  }, now)
}
