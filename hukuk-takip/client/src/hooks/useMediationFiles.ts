import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import type { CreateMediationFileInput, UpdateMediationFileInput } from '@hukuk-takip/shared'

export function useMediationFiles(params?: {
  status?: string
  mediationType?: string
}) {
  return useQuery({
    queryKey: ['mediation-files', params],
    queryFn: async () => {
      const res = await api.get('/mediation-files', { params })
      return res.data
    },
  })
}

export function useMediationFile(id: string | undefined) {
  return useQuery({
    queryKey: ['mediation-files', id],
    queryFn: async () => {
      const res = await api.get(`/mediation-files/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCreateMediationFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateMediationFileInput) => api.post('/mediation-files', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediation-files'] })
      toast.success('Arabuluculuk dosyasi olusturuldu.')
    },
    onError: () => {
      toast.error('Dosya olusturulamadi.')
    },
  })
}

export function useUpdateMediationFile(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateMediationFileInput) => api.put(`/mediation-files/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediation-files'] })
      toast.success('Dosya guncellendi.')
    },
    onError: () => {
      toast.error('Dosya guncellenemedi.')
    },
  })
}

export function useDeleteMediationFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/mediation-files/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediation-files'] })
      toast.success('Dosya silindi.')
    },
    onError: () => {
      toast.error('Dosya silinemedi.')
    },
  })
}
