import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import type { CreateTaskInput, UpdateTaskInput } from '@hukuk-takip/shared'

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

export function useDeadlineTemplates() {
  return useQuery({
    queryKey: ['deadline-templates'],
    queryFn: async () => {
      const res = await api.get('/tasks/deadlines/templates')
      return res.data
    },
    staleTime: 1000 * 60 * 60 * 24, // 1 gün
  })
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

export async function previewDeadline(templateKey: string, triggerEventDate: string) {
  const res = await api.post('/tasks/deadlines/preview', { templateKey, triggerEventDate })
  return res.data as {
    template: { key: string; label: string; durationDays: number; durationYears?: number; legalBasis: string; triggerLabel: string; severity: string; category: string; applyHolidayShift: boolean }
    rawDueDate: string
    adjustedDueDate: string
    wasShifted: boolean
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
    onError: () => {
      toast.error('Görev oluşturulamadı.')
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
    onError: () => {
      toast.error('Görev güncellenemedi.')
    },
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/tasks/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Görev durumu güncellendi.')
    },
    onError: () => {
      toast.error('Görev durumu güncellenemedi.')
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    // Optimistic update — silme anında UI'dan kaldır, hata olursa geri al
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      await queryClient.cancelQueries({ queryKey: ['cases'] })

      const snapshots = queryClient.getQueriesData({ queryKey: ['tasks'] })
      const caseDetailSnaps = queryClient.getQueriesData({ queryKey: ['cases'] })

      queryClient.setQueriesData({ queryKey: ['tasks'] }, (old: any) => {
        if (!old) return old
        if (Array.isArray(old)) return old.filter((t: any) => t.id !== id)
        if (Array.isArray(old?.data)) return { ...old, data: old.data.filter((t: any) => t.id !== id) }
        return old
      })
      queryClient.setQueriesData({ queryKey: ['cases'] }, (old: any) => {
        if (!old || !old.tasks) return old
        return { ...old, tasks: old.tasks.filter((t: any) => t.id !== id) }
      })

      return { snapshots, caseDetailSnaps }
    },
    onError: (_err, _id, ctx) => {
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
