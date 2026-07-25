import { z } from 'zod'

export const installmentStatusValues = ['pending', 'paid', 'partial'] as const
export type InstallmentStatus = (typeof installmentStatusValues)[number]

export const installmentStatusLabels: Record<InstallmentStatus, string> = {
  pending: 'Bekliyor',
  paid: 'Ödendi',
  partial: 'Kısmi',
}

export const createFeeInstallmentSchema = z.object({
  seq: z.number().int().min(1).max(60).optional(),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Geçerli bir tutar girin'),
  dueDate: z.string().min(1, 'Vade tarihi zorunludur'),
  status: z.enum(installmentStatusValues).optional(),
  note: z.string().max(300).optional().or(z.literal('')),
})

export const updateFeeInstallmentSchema = createFeeInstallmentSchema.partial().extend({
  collectionId: z.string().uuid().optional().or(z.literal('')),
})

export type CreateFeeInstallmentInput = z.infer<typeof createFeeInstallmentSchema>
export type UpdateFeeInstallmentInput = z.infer<typeof updateFeeInstallmentSchema>
