import { z } from 'zod'

export const diaryEntryTypeValues = [
  'manual',
  'hearing_added',
  'hearing_updated',
  'hearing_completed',
  'task_added',
  'task_completed',
  'expense_added',
  'collection_added',
  'document_added',
  'status_changed',
  'note_added',
] as const

export const diaryEntryTypeSchema = z.enum(diaryEntryTypeValues)

// Manuel girdi için form şeması — kullanıcı doğrudan yazıyor.
export const createDiaryEntrySchema = z.object({
  title: z.string().trim().max(255).optional().or(z.literal('')),
  content: z.string().trim().min(1, 'Günlük içeriği boş olamaz').max(10000),
  nextStep: z.string().trim().max(2000).optional().or(z.literal('')),
  nextStepDueDate: z.string().optional().or(z.literal('')), // YYYY-MM-DD
  occurredAt: z.string().optional().or(z.literal('')), // ISO datetime; boşsa server now() kullanır
})

// Güncelleme — sadece manuel girdiler için (server entryType='manual' kısıtı uygular).
export const updateDiaryEntrySchema = z.object({
  title: z.string().trim().max(255).optional().or(z.literal('')),
  content: z.string().trim().min(1).max(10000).optional(),
  nextStep: z.string().trim().max(2000).optional().or(z.literal('')),
  nextStepDueDate: z.string().optional().or(z.literal('')),
  occurredAt: z.string().optional().or(z.literal('')),
})

// "Sonraki adım tamamlandı" toggle endpoint'i için.
export const setNextStepDoneSchema = z.object({
  done: z.boolean(),
})

export type CreateDiaryEntryInput = z.infer<typeof createDiaryEntrySchema>
export type UpdateDiaryEntryInput = z.infer<typeof updateDiaryEntrySchema>
export type SetNextStepDoneInput = z.infer<typeof setNextStepDoneSchema>
export type DiaryEntryType = z.infer<typeof diaryEntryTypeSchema>
