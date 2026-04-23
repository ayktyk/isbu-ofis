import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'

export function useNotifications(params?: { unread?: boolean }) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => {
      const res = await api.get('/notifications', { params })
      return res.data
    },
    refetchInterval: 60000, // 60 saniyede bir yenile
  })
}

export function useUnreadCount() {
  const { data } = useNotifications({ unread: true })
  const list = Array.isArray(data) ? data : []
  return list.length
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useDeleteNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    // Optimistic update — silme anında listeden kaldır, hata olursa geri al
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      const snapshots = queryClient.getQueriesData({ queryKey: ['notifications'] })
      queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: any) => {
        if (!old) return old
        if (Array.isArray(old)) return old.filter((n: any) => n.id !== id)
        if (Array.isArray(old?.data)) return { ...old, data: old.data.filter((n: any) => n.id !== id) }
        return old
      })
      return { snapshots }
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
