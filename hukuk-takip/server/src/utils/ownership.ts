import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { caseHearings, cases, clients, collections } from '../db/schema.js'

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
  const [ownedCollection] = await db
    .select({
      id: collections.id,
      caseId: collections.caseId,
      clientId: collections.clientId,
    })
    .from(collections)
    .innerJoin(cases, eq(collections.caseId, cases.id))
    .where(and(eq(collections.id, collectionId), eq(cases.userId, userId)))
    .limit(1)

  return ownedCollection ?? null
}
