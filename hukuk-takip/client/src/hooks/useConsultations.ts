import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import type {
  CreateConsultationInput,
  UpdateConsultationInput,
} from '@hukuk-takip/shared'

export interface ConsultationStats {
  today: number
  week: number
  month: number
  converted: number
  conversionRate: number
  weeklyGoal: number
  monthlyGoal: number
  dailyGoal: number
}

export function useConsultations(params?: {
  status?: string
  source?: string
  from?: string
  to?: string
}) {
  return useQuery({
    queryKey: ['consultations', params],
    queryFn: async () => {
      const res = await api.get('/consultations', { params })
      return res.data
    },
  })
}

export function useConsultationStats() {
  return useQuery<ConsultationStats>({
    queryKey: ['consultations', 'stats'],
    queryFn: async () => {
      const res = await api.get('/consultations/stats')
      return res.data
    },
  })
}

export function useCreateConsultation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateConsultationInput) => api.post('/consultations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Görüşme kaydedildi.')
    },
    onError: () => {
      toast.error('Görüşme kaydedilemedi.')
    },
  })
}

export function useUpdateConsultation(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateConsultationInput) => api.put(`/consultations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Görüşme güncellendi.')
    },
    onError: () => {
      toast.error('Görüşme güncellenemedi.')
    },
  })
}

export function useDeleteConsultation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/consultations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Görüşme silindi.')
    },
    onError: () => {
      toast.error('Görüşme silinemedi.')
    },
  })
}

export function useConvertConsultation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.post(`/consultations/${id}/convert`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(res.data?.message || 'Müvekkil oluşturuldu.')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || 'Dönüştürme başarısız.'
      toast.error(msg)
    },
  })
}
