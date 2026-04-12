import { z } from 'zod'

export const createNoteSchema = z.object({
  caseId: z.string().uuid().optional().or(z.literal('')),
  clientId: z.string().uuid().optional().or(z.literal('')),
  content: z.string().min(1, 'Not içeriği boş olamaz').max(10000),
})

export const updateNoteSchema = z.object({
  content: z.string().min(1, 'Not içeriği boş olamaz').max(10000),
})

export type CreateNoteInput = z.infer<typeof createNoteSchema>
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>
