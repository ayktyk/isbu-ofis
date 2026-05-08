import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/axios'

export function useNotifications(params?: { unread?: boolean }) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => {
      const res = await api.get('/notifications', { params })
      return res.data
    },
    // 5 dk taze say — sayfa geçişlerinde gereksiz refetch yok. Polling 3 dk'da bir
    // arka planda yine taze veri çekiyor; mutation'lar (delete/markAsRead)
    // invalidateQueries ile anında geçersiz kılıyor, yan etki yok. Önceki 60sn
    // değer dashboard ↔ notifications hızlı tab geçişinde fazladan refetch
    // tetikliyordu, kullanıcıya yavaşlık olarak yansıyordu.
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 3,
    refetchIntervalInBackground: false,
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
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Bildirim güncellenemedi.'
      toast.error(message)
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
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Bildirimler güncellenemedi.'
      toast.error(message)
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
