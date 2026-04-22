import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { caseHearings, cases, clients, collections, mediationFiles } from '../db/schema.js'

export async function getOwnedCase(userId: string, caseId: string) {
  const [ownedCase] = await db
    .select({
      id: cases.id,
      clientId: cases.clientId,
      userId: cases.userId,
    })
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.userId, userId)))
    .limit(1)

  return ownedCase ?? null
}

export async function getOwnedClient(userId: string, clientId: string) {
  const [ownedClient] = await db
    .select({
      id: clients.id,
      userId: clients.userId,
    })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
    .limit(1)

  return ownedClient ?? null
}

export async function getOwnedHearing(userId: string, hearingId: string) {
  const [ownedHearing] = await db
    .select({
      id: caseHearings.id,
      caseId: caseHearings.caseId,
    })
    .from(caseHearings)
    .innerJoin(cases, eq(caseHearings.caseId, cases.id))
    .where(and(eq(caseHearings.id, hearingId), eq(cases.userId, userId)))
    .limit(1)

  return ownedHearing ?? null
}

export async function getOwnedCollection(userId: string, collectionId: string) {
  // Polimorfik: user_id alanı artık direkt collections'ta. Eski satırlar için
  // case.user_id join fallback'i ile geriye dönük uyumlu.
  const [ownedCollection] = await db
    .select({
      id: collections.id,
      caseId: collections.caseId,
      mediationFileId: collections.mediationFileId,
      clientId: collections.clientId,
      userId: collections.userId,
    })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
    .limit(1)

  if (ownedCollection) return ownedCollection

  // Fallback: user_id henüz backfill edilmediyse case üzerinden dene
  const [legacy] = await db
    .select({
      id: collections.id,
      caseId: collections.caseId,
      mediationFileId: collections.mediationFileId,
      clientId: collections.clientId,
      userId: cases.userId,
    })
    .from(collections)
    .innerJoin(cases, eq(collections.caseId, cases.id))
    .where(and(eq(collections.id, collectionId), eq(cases.userId, userId)))
    .limit(1)

  return legacy ?? null
}

export async function getOwnedMediationFile(userId: string, mediationFileId: string) {
  const [owned] = await db
    .select({
      id: mediationFiles.id,
      userId: mediationFiles.userId,
      agreedFee: mediationFiles.agreedFee,
      currency: mediationFiles.currency,
    })
    .from(mediationFiles)
    .where(and(eq(mediationFiles.id, mediationFileId), eq(mediationFiles.userId, userId)))
    .limit(1)

  return owned ?? null
}
