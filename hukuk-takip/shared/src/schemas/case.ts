import { z } from 'zod'

export const caseStatusValues = [
  'active',
  'istinafta',
  'yargıtayda',
  'passive',
  'closed',
  'won',
  'lost',
  'settled',
] as const

export const caseTypeValues = [
  'iscilik_alacagi',
  'bosanma',
  'velayet',
  'mal_paylasimi',
  'kira',
  'tuketici',
  'icra',
  'ceza',
  'idare',
  'diger',
] as const

// Esnek ücret anlaşması. Avukat bazen sadece maktu tutara, bazen sadece
// yüzdeye, bazen ikisine birden anlaşıyor.
export const feeTypeValues = ['fixed', 'percentage', 'fixed_plus_percentage'] as const
// Yüzdenin neyin üzerinden hesaplanacağı: tahsil edilen mi, hükmedilen mi?
export const feePercentageBaseValues = ['collected', 'awarded'] as const
export const feePaymentPlanValues = ['single', 'installment'] as const

export type FeeType = (typeof feeTypeValues)[number]
export type FeePercentageBase = (typeof feePercentageBaseValues)[number]
export type FeePaymentPlan = (typeof feePaymentPlanValues)[number]

export const feeTypeLabels: Record<FeeType, string> = {
  fixed: 'Maktu',
  percentage: 'Yüzdelik',
  fixed_plus_percentage: 'Maktu + Yüzdelik',
}

export const feePercentageBaseLabels: Record<FeePercentageBase, string> = {
  collected: 'Tahsil edilen üzerinden',
  awarded: 'Hükmedilen üzerinden',
}

export const createCaseSchema = z.object({
  clientId: z.string().uuid('Gecerli bir muvekkil secin'),
  caseNumber: z.string().max(100).optional().or(z.literal('')),
  courtName: z.string().max(255).optional().or(z.literal('')),
  caseType: z.enum(caseTypeValues, { errorMap: () => ({ message: 'Dava turu secin' }) }),
  customCaseType: z.string().max(255).optional().or(z.literal('')),
  title: z.string().min(3, 'Dava basligi en az 3 karakter olmalidir').max(500),
  description: z.string().max(10000).optional().or(z.literal('')),
  startDate: z.string().optional().or(z.literal('')),
  contractedFee: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Gecerli bir tutar girin')
    .optional()
    .or(z.literal('')),
  currency: z.string().length(3).default('TRY'),
  // Esnek ücret alanları — hepsi opsiyonel, boş bırakılırsa mevcut davranış
  // (yalnızca maktu contractedFee) aynen korunur.
  feeType: z.enum(feeTypeValues).optional().or(z.literal('')),
  feePercentage: z
    .string()
    .regex(/^\d{1,2}([.]\d{1,2})?$/, 'Oran 0-99 arası olmalıdır')
    .optional()
    .or(z.literal('')),
  feePercentageBase: z.enum(feePercentageBaseValues).optional().or(z.literal('')),
  feePercentageNote: z.string().max(500).optional().or(z.literal('')),
  feePaymentPlan: z.enum(feePaymentPlanValues).optional().or(z.literal('')),
  // CMK (Ceza Muhakemesi Kanunu) zorunlu müdafilik görevlendirmesi mi?
  // True ise dava normal davalar listesinde değil "CMK Görevlendirmeleri" sayfasında görünür.
  isCmkAssignment: z.boolean().optional(),
})

export const updateCaseSchema = createCaseSchema.partial().extend({
  status: z.enum(caseStatusValues).optional(),
  closeDate: z.string().optional().or(z.literal('')),
})

export type CreateCaseInput = z.infer<typeof createCaseSchema>
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>
