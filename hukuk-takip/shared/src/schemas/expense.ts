import { z } from 'zod'

export const expenseTypeValues = [
  'court_fee',
  'notary',
  'expert',
  'travel',
  'document',
  'other',
] as const

export const createExpenseSchema = z.object({
  caseId: z.string().uuid('Geçerli bir dava seçin'),
  type: z.enum(expenseTypeValues, { errorMap: () => ({ message: 'Masraf türü seçin' }) }),
  description: z.string().min(2, 'Açıklama en az 2 karakter olmalıdır').max(500),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Geçerli bir tutar girin'),
  currency: z.string().length(3).default('TRY'),
  expenseDate: z.string().min(1, 'Masraf tarihi gereklidir'),
  isBillable: z.boolean().default(true),
})

export const updateExpenseSchema = createExpenseSchema.partial()

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
