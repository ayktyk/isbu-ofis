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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hearings'] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Duruşma silindi.')
    },
    onError: () => {
      toast.error('Duruşma silinemedi.')
    },
  })
}
