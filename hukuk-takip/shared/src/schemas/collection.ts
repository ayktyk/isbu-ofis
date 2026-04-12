import { z } from 'zod'

export const createCollectionSchema = z.object({
  caseId: z.string().uuid('Geçerli bir dava seçin'),
  clientId: z.string().uuid('Geçerli bir müvekkil seçin'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Geçerli bir tutar girin'),
  currency: z.string().length(3).default('TRY'),
  collectionDate: z.string().min(1, 'Tahsilat tarihi gereklidir'),
  description: z.string().max(500).optional().or(z.literal('')),
  paymentMethod: z.string().max(50).optional().or(z.literal('')),
  receiptNo: z.string().max(100).optional().or(z.literal('')),
})

export const updateCollectionSchema = createCollectionSchema.partial()

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>
