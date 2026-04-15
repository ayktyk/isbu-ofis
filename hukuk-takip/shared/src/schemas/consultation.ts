import { z } from 'zod'

export const consultationTypeValues = ['phone', 'in_person'] as const
export const consultationStatusValues = ['pending', 'potential', 'converted', 'declined'] as const
export const consultationSourceValues = [
  'client_referral',
  'past_client',
  'friend',
  'google',
  'website',
  'other',
] as const

export const consultationTypeLabels: Record<string, string> = {
  phone: 'Telefon',
  in_person: 'Yüz Yüze',
}

export const consultationStatusLabels: Record<string, string> = {
  pending: 'Bekliyor',
  potential: 'Potansiyel Müvekkil',
  converted: 'Müvekkil Oldu',
  declined: 'İlgilenmedi',
}

export const consultationSourceLabels: Record<string, string> = {
  client_referral: 'Müvekkil Tavsiyesi',
  past_client: 'Eski Müvekkil',
  friend: 'Arkadaş',
  google: 'Google',
  website: 'Web Sitemiz',
  other: 'Diğer',
}

export const createConsultationSchema = z.object({
  consultationDate: z.string().min(1, 'Tarih gerekli'),
  fullName: z.string().min(2, 'Ad soyad en az 2 karakter olmalıdır').max(255),
  phone: z.string().max(20).optional().or(z.literal('')),
  type: z.enum(consultationTypeValues).default('phone'),
  subject: z.string().max(500).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
  status: z.enum(consultationStatusValues).default('pending'),
  source: z.enum(consultationSourceValues).optional().or(z.literal('')),
  sourceDetail: z.string().max(255).optional().or(z.literal('')),
  referredByClientId: z.string().uuid().optional().or(z.literal('')),
  nextActionDate: z.string().optional().or(z.literal('')),
})

export const updateConsultationSchema = createConsultationSchema.partial()

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>
