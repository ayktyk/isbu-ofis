import { z } from 'zod'

export const taskStatusValues = ['pending', 'in_progress', 'completed', 'cancelled'] as const
export const taskPriorityValues = ['low', 'medium', 'high', 'urgent'] as const

export const createTaskSchema = z.object({
  caseId: z.string().uuid().optional().or(z.literal('')),
  label: z.string().max(100).optional().or(z.literal('')),
  title: z.string().min(2, 'Görev başlığı en az 2 karakter olmalıdır').max(500),
  description: z.string().max(5000).optional().or(z.literal('')),
  priority: z.enum(taskPriorityValues).default('medium'),
  dueDate: z.string().optional().or(z.literal('')),
})

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum(taskStatusValues).optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
