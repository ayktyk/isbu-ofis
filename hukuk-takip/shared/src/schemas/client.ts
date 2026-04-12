import { z } from 'zod'

export const createClientSchema = z.object({
  fullName: z.string().min(2, 'Ad soyad en az 2 karakter olmalıdır').max(255),
  tcNo: z
    .string()
    .length(11, 'TC Kimlik No 11 haneli olmalıdır')
    .regex(/^\d+$/, 'TC Kimlik No sadece rakam içermelidir')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .min(10, 'Telefon numarası en az 10 haneli olmalıdır')
    .max(20)
    .optional()
    .or(z.literal('')),
  email: z.string().email('Geçerli bir e-posta girin').optional().or(z.literal('')),
  address: z.string().max(1000).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export const updateClientSchema = createClientSchema.partial()

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
