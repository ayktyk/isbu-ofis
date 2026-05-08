import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  LEGAL_DEADLINE_TEMPLATES,
  computeLegalDeadline,
  type CreateTaskInput,
  type LegalDeadlineTemplate,
  type UpdateTaskInput,
} from '@hukuk-takip/shared'
import { api } from '@/lib/axios'

function taskMatchesParams(task: any, params: any) {
  if (!params) return true
  if (params.status && task.status !== params.status) return false
  if (params.priority && task.priority !== params.priority) return false
  if (typeof params.isDeadline === 'boolean' && task.isDeadline !== params.isDeadline) return false
  if (params.category && task.deadlineCategory !== params.category) return false
  if (params.severity && task.deadlineSeverity !== params.severity) return false
  return true
}

function patchTaskList(list: any[], updatedTask: any, params?: any) {
  let changed = false
  const next = list
    .map((task) => {
      if (task?.id !== updatedTask.id) return task
      changed = true
      return { ...task, ...updatedTask }
    })
    .filter((task) => task?.id !== updatedTask.id || taskMatchesParams(task, params))

  return changed ? next : list
}

function patchTaskCacheValue(old: any, updatedTask: any, params?: any) {
  if (!old) return old
  if (Array.isArray(old)) return patchTaskList(old, updatedTask, params)
  if (Array.isArray(old.data)) {
    return { ...old, data: patchTaskList(old.data, updatedTask, params) }
  }
  if (old.id === updatedTask.id) return { ...old, ...updatedTask }
  return old
}

function patchCriticalDeadlineCacheValue(old: any, updatedTask: any) {
  const activeDeadline =
    updatedTask.isDeadline === true &&
    (updatedTask.status === 'pending' || updatedTask.status === 'in_progress')

  const patchList = (list: any[]) => {
    const hasTask = list.some((task) => task?.id === updatedTask.id)
    if (!hasTask) return list
    if (!activeDeadline) return list.filter((task) => task?.id !== updatedTask.id)
    return list.map((task) => (task?.id === updatedTask.id ? { ...task, ...updatedTask } : task))
  }

  if (!old) return old
  if (Array.isArray(old)) return patchList(old)
  if (Array.isArray(old.data)) return { ...old, data: patchList(old.data) }
  return old
}

function patchDashboardCacheValue(old: any, updatedTask: any) {
  if (!old) return old

  const activeDeadline =
    updatedTask.isDeadline === true &&
    (updatedTask.status === 'pending' || updatedTask.status === 'in_progress')
  const patchCritical = (list: any[]) => {
    const hasTask = list.some((task) => task?.id === updatedTask.id)
    if (!hasTask) return list
    if (!activeDeadline) return list.filter((task) => task?.id !== updatedTask.id)
    return list.map((task) => (task?.id === updatedTask.id ? { ...task, ...updatedTask } : task))
  }

  const patchPendingTasks = (list: any[]) => {
    const hasTask = list.some((task) => task?.id === updatedTask.id)
    if (!hasTask) return list
    if (updatedTask.status !== 'pending' || updatedTask.isDeadline === true) {
      return list.filter((task) => task?.id !== updatedTask.id)
    }
    return list.map((task) => (task?.id === updatedTask.id ? { ...task, ...updatedTask } : task))
  }

  return {
    ...old,
    criticalDeadlines: Array.isArray(old.criticalDeadlines)
      ? patchCritical(old.criticalDeadlines)
      : old.criticalDeadlines,
    pendingTasks: Array.isArray(old.pendingTasks)
      ? patchPendingTasks(old.pendingTasks)
      : old.pendingTasks,
  }
}

function patchTaskCaches(queryClient: ReturnType<typeof useQueryClient>, updatedTask: any) {
  queryClient.getQueriesData({ queryKey: ['tasks'] }).forEach(([queryKey, old]) => {
    const params = Array.isArray(queryKey) ? queryKey[1] : undefined
    queryClient.setQueryData(queryKey, patchTaskCacheValue(old, updatedTask, params))
  })

  queryClient.getQueriesData({ queryKey: ['deadlines'] }).forEach(([queryKey, old]) => {
    queryClient.setQueryData(queryKey, patchCriticalDeadlineCacheValue(old, updatedTask))
  })

  queryClient.getQueriesData({ queryKey: ['dashboard'] }).forEach(([queryKey, old]) => {
    queryClient.setQueryData(queryKey, patchDashboardCacheValue(old, updatedTask))
  })

  queryClient.setQueriesData({ queryKey: ['cases'] }, (old: any) => {
    if (!old || !Array.isArray(old.tasks)) return old
    return { ...old, tasks: patchTaskList(old.tasks, updatedTask) }
  })
}

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
    placeholderData: keepPreviousData,
    // Sayfa geçişlerinde anında render — 1 dk taze sayılır, mount'ta sadece
    // stale ise refetch (default refetchOnMount: true). Invalidation sonrası
    // (görev tamamlama, yeni görev) bir sonraki mount'ta otomatik tazelenir.
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 30,
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
  const [yearRaw, monthRaw, dayRaw] = value.split('-').map((part) => Number.parseInt(part, 10))
  // Geçersiz parça → bugün döner (frontend tarihler input restricted, NaN olmamalı
  // ama defensive). Aşağıdaki computeLegalDeadline NaN tarih ile hesap yapamaz.
  const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear()
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : 1
  const day = Number.isFinite(dayRaw) && dayRaw >= 1 && dayRaw <= 31 ? dayRaw : 1
  return new Date(year, month - 1, day)
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
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
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
    onSuccess: (response) => {
      patchTaskCaches(queryClient, response.data)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
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
    // Optimistic update — kullanıcı "Yapıldı" tıkladığı an task hem listelerden
    // (aktif filtre ile) düşer hem de dashboard "kritik süreli işler" bandından
    // kalkar. Server cevabı beklenmez. Hata olursa snapshot'tan geri yüklenir.
    onMutate: async ({ id, status, completionEvidence }) => {
      // Aktif refetch'leri iptal et ki optimistic değer üzerine yazmasın
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['tasks'] }),
        queryClient.cancelQueries({ queryKey: ['deadlines'] }),
        queryClient.cancelQueries({ queryKey: ['dashboard'] }),
        queryClient.cancelQueries({ queryKey: ['cases'] }),
      ])

      const taskSnapshots = queryClient.getQueriesData({ queryKey: ['tasks'] })
      const deadlineSnapshots = queryClient.getQueriesData({ queryKey: ['deadlines'] })
      const dashboardSnapshots = queryClient.getQueriesData({ queryKey: ['dashboard'] })
      const caseSnapshots = queryClient.getQueriesData({ queryKey: ['cases'] })

      const optimisticPatch: Record<string, unknown> = {
        id,
        status,
        completedAt: status === 'completed' ? new Date().toISOString() : null,
      }
      if (completionEvidence !== undefined) {
        optimisticPatch.completionEvidence = completionEvidence
      }

      patchTaskCaches(queryClient, optimisticPatch)

      return { taskSnapshots, deadlineSnapshots, dashboardSnapshots, caseSnapshots }
    },
    onSuccess: (response) => {
      // Server'ın gönderdiği gerçek değerleri yine cache'e yedir (completedAt timestamp,
      // updatedAt vs server-generated alanlar). Optimistic patch ile aynı task ama
      // tam değerlerle.
      patchTaskCaches(queryClient, response.data)
      toast.success('Görev durumu güncellendi.')
    },
    onError: (error: any, _vars, ctx) => {
      // Hata: optimistic değişiklikleri geri al
      ctx?.taskSnapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      ctx?.deadlineSnapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      ctx?.dashboardSnapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      ctx?.caseSnapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      const message = error?.response?.data?.error || 'Görev durumu güncellenemedi.'
      toast.error(message)
    },
    onSettled: () => {
      // Server'la senkron kalmak için arka planda refetch — kullanıcı bekletilmez,
      // çünkü optimistic patch zaten ekranı güncelledi.
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
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
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onSuccess: () => {
      toast.success('Görev silindi.')
    },
  })
}
