import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { caseHearings, cases, clients } from '../db/schema.js'
import { syncHearingToGoogleCalendar, syncTaskToGoogleCalendar } from './googleCalendar.js'

// Duruşma → Google Takvim senkronu için tek kod yolu. Hem avukatın duruşma
// route'ları hem de onaylanan asistan önerileri bunu kullanır.
export async function getHearingCalendarContext(userId: string, hearingId: string) {
  const [hearingRow] = await db
    .select({
      id: caseHearings.id,
      hearingDate: caseHearings.hearingDate,
      result: caseHearings.result,
      notes: caseHearings.notes,
      courtRoom: caseHearings.courtRoom,
      judge: caseHearings.judge,
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
        eq(caseHearings.id, hearingId),
        eq(cases.userId, userId),
        isNull(caseHearings.archivedAt),
        isNull(cases.archivedAt)
      )
    )
    .limit(1)

  return hearingRow ?? null
}

// Hata fırlatmaz: takvim senkronu başarısız olsa da kayıt işlemi geçerli kalır.
export async function syncHearingCalendarSafe(userId: string, hearingId: string, phase: string) {
  try {
    const hearingContext = await getHearingCalendarContext(userId, hearingId)
    if (hearingContext) {
      await syncHearingToGoogleCalendar({
        hearingId: hearingContext.id,
        hearingDate: hearingContext.hearingDate,
        result: hearingContext.result,
        notes: hearingContext.notes,
        courtRoom: hearingContext.courtRoom,
        judge: hearingContext.judge,
        caseTitle: hearingContext.caseTitle,
        caseNumber: hearingContext.caseNumber,
        courtName: hearingContext.courtName,
        clientName: hearingContext.clientName,
      })
    }
  } catch (error) {
    console.error(`[GoogleCalendar] Hearing ${phase} sync failed`, hearingId, error)
  }
}

export async function syncTaskCalendarSafe(
  task: { id: string; title: string; description: string | null; dueDate: Date | null; label: string | null; status: string },
  caseTitle: string | null,
  phase: string
) {
  try {
    await syncTaskToGoogleCalendar({
      taskId: task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      label: task.label,
      status: task.status,
      caseTitle,
    })
  } catch (error) {
    console.error(`[GoogleCalendar] Task ${phase} sync failed`, task.id, error)
  }
}
