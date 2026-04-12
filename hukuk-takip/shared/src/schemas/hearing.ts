import { z } from 'zod'

export const hearingResultValues = [
  'pending',
  'completed',
  'postponed',
  'cancelled',
] as const

export const createHearingSchema = z.object({
  caseId: z.string().uuid('Geçerli bir dava seçin'),
  hearingDate: z.string().min(1, 'Duruşma tarihi gereklidir'),
  courtRoom: z.string().max(100).optional().or(z.literal('')),
  judge: z.string().max(255).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export const updateHearingSchema = createHearingSchema.partial().extend({
  result: z.enum(hearingResultValues).optional(),
  nextHearingDate: z.string().optional().or(z.literal('')),
})

export type CreateHearingInput = z.infer<typeof createHearingSchema>
export type UpdateHearingInput = z.infer<typeof updateHearingSchema>
