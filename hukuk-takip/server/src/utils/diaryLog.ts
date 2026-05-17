import { db } from '../db/index.js'
import { caseDiaryEntries } from '../db/schema.js'

type DiaryEntryType =
  | 'manual'
  | 'hearing_added'
  | 'hearing_updated'
  | 'hearing_completed'
  | 'task_added'
  | 'task_completed'
  | 'expense_added'
  | 'collection_added'
  | 'document_added'
  | 'status_changed'
  | 'note_added'

interface LogDiaryEntryInput {
  caseId: string
  userId: string
  entryType: DiaryEntryType
  title?: string | null
  content?: string | null
  linkedEntityType?: string | null
  linkedEntityId?: string | null
  occurredAt?: Date
}

/**
 * Otomatik dava günlüğü girdisi yaratır. Çağıran route'un ana iş akışını
 * etkilememesi için **her zaman try/catch ile sarılı** çalışır — diary insert
 * başarısız olursa sadece console'a uyarı düşer, throw etmez.
 *
 * Manuel girdiler caseDiary.ts route'undan doğrudan yazılır; burası sadece
 * sistem olaylarını günlüğe basmak için.
 */
export async function logDiaryEntry(input: LogDiaryEntryInput): Promise<void> {
  if (!input.caseId || !input.userId) {
    return
  }

  try {
    await db.insert(caseDiaryEntries).values({
      caseId: input.caseId,
      userId: input.userId,
      entryType: input.entryType,
      title: input.title || null,
      content: input.content || null,
      linkedEntityType: input.linkedEntityType || null,
      linkedEntityId: input.linkedEntityId || null,
      occurredAt: input.occurredAt || new Date(),
    })
  } catch (err) {
    // Diary insert başarısız olsa bile ana işlem kırılmasın.
    console.warn('[diaryLog] entry kaydedilemedi:', err)
  }
}
