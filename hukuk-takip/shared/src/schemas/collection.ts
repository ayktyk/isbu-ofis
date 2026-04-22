import { z } from 'zod'

// Tahsilat ya bir davaya bağlı (caseId) ya da bir arabuluculuk dosyasına (mediationFileId).
// İkisinden tam olarak biri dolu olmalı.
export const createCollectionSchema = z
  .object({
    caseId: z.string().uuid('Geçerli bir dava seçin').optional(),
    mediationFileId: z.string().uuid('Geçerli bir arabuluculuk dosyası seçin').optional(),
    clientId: z.string().uuid('Geçerli bir müvekkil seçin').optional(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Geçerli bir tutar girin'),
    currency: z.string().length(3).default('TRY'),
    collectionDate: z.string().min(1, 'Tahsilat tarihi gereklidir'),
    description: z.string().max(500).optional().or(z.literal('')),
    paymentMethod: z.string().max(50).optional().or(z.literal('')),
    receiptNo: z.string().max(100).optional().or(z.literal('')),
  })
  .refine((d) => !!d.caseId !== !!d.mediationFileId, {
    message: 'Tahsilat bir davaya veya arabuluculuk dosyasına bağlı olmalı (ikisi birden olamaz).',
    path: ['caseId'],
  })

export const updateCollectionSchema = z.object({
  caseId: z.string().uuid().optional(),
  mediationFileId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  currency: z.string().length(3).optional(),
  collectionDate: z.string().optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  paymentMethod: z.string().max(50).optional().or(z.literal('')),
  receiptNo: z.string().max(100).optional().or(z.literal('')),
})

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>
