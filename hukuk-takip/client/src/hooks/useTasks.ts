import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  LEGAL_DEADLINE_TEMPLATES,
  computeLegalDeadline,
  type CreateTaskInput,
  type LegalDeadlineTemplate,
  type UpdateTaskInput,
} from '@hukuk-takip/shared'
import { api } from '@/lib/axios'

export function useTasks(params?: {
  status?: string
  priority?: string
  page?: number
  pageSize?: number
  isDeadline?: boolean
  category?: string
  severity?: string
  dueWithinDays?: number
}) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: async () => {
      const res = await api.get('/tasks', { params })
      return res.data
    },
  })
}

// Static templates are read directly from shared to avoid a network roundtrip in PWA usage.
export function useDeadlineTemplates() {
  return {
    data: LEGAL_DEADLINE_TEMPLATES as LegalDeadlineTemplate[],
    isLoading: false,
    isError: false,
  }
}

export function useCriticalDeadlines(withinDays = 7) {
  return useQuery({
    queryKey: ['deadlines', 'critical', withinDays],
    queryFn: async () => {
      const res = await api.get('/tasks/deadlines/critical', { params: { withinDays } })
      return res.data as any[]
    },
    staleTime: 1000 * 60 * 5,
  })
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10))
  return new Date(year, (month || 1) - 1, day || 1)
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Preview is calculated on the client for instant feedback in PWA mode.
export async function previewDeadline(templateKey: string, triggerEventDate: string) {
  const tpl = LEGAL_DEADLINE_TEMPLATES.find((template) => template.key === templateKey)
  if (!tpl) {
    throw new Error('Süre şablonu bulunamadı.')
  }

  const trigger = parseDateInput(triggerEventDate)
  if (Number.isNaN(trigger.getTime())) {
    throw new Error('Geçersiz tetikleyici tarih.')
  }

  const result = computeLegalDeadline(tpl, trigger)
  return {
    template: tpl,
    rawDueDate: formatDateOnly(result.rawDueDate),
    adjustedDueDate: formatDateOnly(result.adjustedDueDate),
    wasShifted: result.wasShifted,
  }
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateTaskInput) => api.post('/tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Görev oluşturuldu.')
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Görev oluşturulamadı.'
      toast.error(message)
    },
  })
}

export function useUpdateTask(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateTaskInput) => api.put(`/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Görev güncellendi.')
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Görev güncellenemedi.'
      toast.error(message)
    },
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      status,
      completionEvidence,
    }: {
      id: string
      status: string
      completionEvidence?: string
    }) => api.patch(`/tasks/${id}/status`, { status, completionEvidence }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Görev durumu güncellendi.')
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Görev durumu güncellenemedi.'
      toast.error(message)
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      await queryClient.cancelQueries({ queryKey: ['cases'] })

      const snapshots = queryClient.getQueriesData({ queryKey: ['tasks'] })
      const caseDetailSnaps = queryClient.getQueriesData({ queryKey: ['cases'] })

      queryClient.setQueriesData({ queryKey: ['tasks'] }, (old: any) => {
        if (!old) return old
        if (Array.isArray(old)) return old.filter((task: any) => task.id !== id)
        if (Array.isArray(old?.data)) {
          return { ...old, data: old.data.filter((task: any) => task.id !== id) }
        }
        return old
      })

      queryClient.setQueriesData({ queryKey: ['cases'] }, (old: any) => {
        if (!old || !old.tasks) return old
        return { ...old, tasks: old.tasks.filter((task: any) => task.id !== id) }
      })

      return { snapshots, caseDetailSnaps }
    },
    onError: (_error, _id, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      ctx?.caseDetailSnaps?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      toast.error('Görev silinemedi.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onSuccess: () => {
      toast.success('Görev silindi.')
    },
  })
}
