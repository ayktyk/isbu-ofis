import { z } from 'zod'

export const mediationTypeValues = ['dava_sarti', 'ihtiyari'] as const
export const mediationStatusValues = ['active', 'agreed', 'not_agreed', 'partially_agreed', 'cancelled'] as const

const partySchema = z.object({
  side: z.enum(['applicant', 'respondent']),
  fullName: z.string().min(2, 'Ad soyad en az 2 karakter olmali'),
  tcNo: z.string().max(255).optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  email: z.string().max(255).optional().or(z.literal('')),
  address: z.string().max(2000).optional().or(z.literal('')),
  lawyerName: z.string().max(255).optional().or(z.literal('')),
  lawyerBarNo: z.string().max(50).optional().or(z.literal('')),
  lawyerPhone: z.string().max(20).optional().or(z.literal('')),
})

const currencySchema = z.string().length(3).default('TRY')
const agreedFeeSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Geçerli bir tutar girin')
  .optional()
  .or(z.literal(''))

export const createMediationFileSchema = z.object({
  fileNo: z.string().max(100).optional().or(z.literal('')),
  mediationType: z.enum(mediationTypeValues, {
    errorMap: () => ({ message: 'Arabuluculuk turu secin' }),
  }),
  disputeType: z.string().min(1, 'Uyusmazlik turu secin'),
  disputeSubject: z.string().max(5000).optional().or(z.literal('')),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  agreedFee: agreedFeeSchema,
  currency: currencySchema.optional(),
  notes: z.string().max(5000).optional().or(z.literal('')),
  parties: z.array(partySchema).min(1, 'En az bir taraf ekleyin'),
})

export const updateMediationFileSchema = z.object({
  fileNo: z.string().max(100).optional().or(z.literal('')),
  mediationType: z.enum(mediationTypeValues).optional(),
  disputeType: z.string().optional(),
  disputeSubject: z.string().max(5000).optional().or(z.literal('')),
  status: z.enum(mediationStatusValues).optional(),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  agreedFee: agreedFeeSchema,
  currency: currencySchema.optional(),
  notes: z.string().max(5000).optional().or(z.literal('')),
  parties: z.array(partySchema).optional(),
})

export type CreateMediationFileInput = z.infer<typeof createMediationFileSchema>
export type UpdateMediationFileInput = z.infer<typeof updateMediationFileSchema>
export type MediationPartyInput = z.infer<typeof partySchema>
