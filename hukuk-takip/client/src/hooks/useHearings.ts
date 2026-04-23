import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import type { CreateHearingInput, UpdateHearingInput } from '@hukuk-takip/shared'

export function useHearings(params?: { upcoming?: boolean }) {
  return useQuery({
    queryKey: ['hearings', params],
    queryFn: async () => {
      const res = await api.get('/hearings', { params })
      return res.data
    },
  })
}

export function useCreateHearing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateHearingInput) => api.post('/hearings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hearings'] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Duruşma eklendi.')
    },
    onError: () => {
      toast.error('Duruşma eklenemedi.')
    },
  })
}

export function useUpdateHearing(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateHearingInput) => api.put(`/hearings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hearings'] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Duruşma güncellendi.')
    },
    onError: () => {
      toast.error('Duruşma güncellenemedi.')
    },
  })
}

export function useDeleteHearing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/hearings/${id}`),
    // Optimistic update — silme anında UI'dan kaldır, hata olursa geri al
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['hearings'] })
      await queryClient.cancelQueries({ queryKey: ['cases'] })

      const snapshots = queryClient.getQueriesData({ queryKey: ['hearings'] })
      const caseSnaps = queryClient.getQueriesData({ queryKey: ['cases'] })

      queryClient.setQueriesData({ queryKey: ['hearings'] }, (old: any) => {
        if (!old) return old
        if (Array.isArray(old)) return old.filter((h: any) => h.id !== id)
        if (Array.isArray(old?.data)) return { ...old, data: old.data.filter((h: any) => h.id !== id) }
        return old
      })
      queryClient.setQueriesData({ queryKey: ['cases'] }, (old: any) => {
        if (!old || !old.hearings) return old
        return { ...old, hearings: old.hearings.filter((h: any) => h.id !== id) }
      })

      return { snapshots, caseSnaps }
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      ctx?.caseSnaps?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      toast.error('Duruşma silinemedi.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['hearings'] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onSuccess: () => {
      toast.success('Duruşma silindi.')
    },
  })
}
