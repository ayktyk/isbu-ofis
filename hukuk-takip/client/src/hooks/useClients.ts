import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import type { CreateClientInput, UpdateClientInput } from '@hukuk-takip/shared'

export function useClients(params?: { search?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: async () => {
      const res = await api.get('/clients', { params })
      return res.data
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  })
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      const res = await api.get(`/clients/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useClientCases(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id, 'cases'],
    queryFn: async () => {
      const res = await api.get(`/clients/${id}/cases`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateClientInput) => api.post('/clients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Müvekkil oluşturuldu.')
    },
    onError: () => {
      toast.error('Müvekkil oluşturulamadı.')
    },
  })
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateClientInput) => api.put(`/clients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Müvekkil güncellendi.')
    },
    onError: () => {
      toast.error('Müvekkil güncellenemedi.')
    },
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Müvekkil silindi.')
    },
    onError: () => {
      toast.error('Müvekkil silinemedi.')
    },
  })
}
