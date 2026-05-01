import { z } from 'zod'
import { deadlineCategoryValues, deadlineSeverityValues } from '../legalDeadlines.js'

export const taskStatusValues = ['pending', 'in_progress', 'completed', 'cancelled'] as const
export const taskPriorityValues = ['low', 'medium', 'high', 'urgent'] as const

const optionalString = (max?: number) => {
  const base = max ? z.string().max(max) : z.string()
  return base.optional().or(z.literal(''))
}

const optionalDate = z.string().optional().or(z.literal(''))

export const createTaskSchema = z.object({
  caseId: z.string().uuid().optional().or(z.literal('')),
  label: z.string().max(100).optional().or(z.literal('')),
  title: z.string().min(2, 'Görev başlığı en az 2 karakter olmalıdır').max(500),
  description: z.string().max(5000).optional().or(z.literal('')),
  priority: z.enum(taskPriorityValues).default('medium'),
  dueDate: optionalDate,

  // Süreli iş alanları (opsiyonel — eski normal görevlerde olmaz)
  isDeadline: z.boolean().optional(),
  deadlineTemplateKey: optionalString(80),
  deadlineCategory: z.enum(deadlineCategoryValues).optional(),
  deadlineSeverity: z.enum(deadlineSeverityValues).optional(),
  triggerEventDate: optionalDate,
  triggerEventLabel: optionalString(200),
  calculatedDueDate: optionalDate,
  adjustedForHoliday: z.boolean().optional(),
  legalBasis: optionalString(200),
})

export const updateTaskSchema = createTaskSchema
  .partial()
  .extend({
    status: z.enum(taskStatusValues).optional(),
    completionEvidence: optionalString(2000),
  })
  .refine(
    (d) => {
      if (d.isDeadline === true && d.status === 'completed') {
        return !!d.completionEvidence && d.completionEvidence.trim().length >= 5
      }
      return true
    },
    {
      message: 'Süreli iş tamamlanırken en az 5 karakterlik kanıt notu zorunludur.',
      path: ['completionEvidence'],
    }
  )

// Süreli iş önizleme isteği — şablon ve tetik tarihinden son günü hesaplar.
export const previewDeadlineSchema = z.object({
  templateKey: z.string().min(1).max(80),
  triggerEventDate: z.string().min(1, 'Tetikleyici tarih zorunludur'),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type PreviewDeadlineInput = z.infer<typeof previewDeadlineSchema>
