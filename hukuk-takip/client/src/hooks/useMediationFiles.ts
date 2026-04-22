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

// ─── Tahsilatlar (arabuluculuk) ──────────────────────────────────────────────

export function useMediationFileCollections(mediationFileId: string | undefined) {
  return useQuery({
    queryKey: ['mediation-files', mediationFileId, 'collections'],
    queryFn: async () => {
      const res = await api.get(`/mediation-files/${mediationFileId}/collections`)
      return res.data as Array<{
        id: string
        mediationFileId: string | null
        caseId: string | null
        amount: string
        currency: string
        collectionDate: string
        description: string | null
        paymentMethod: string | null
        receiptNo: string | null
        createdAt: string
      }>
    },
    enabled: !!mediationFileId,
  })
}

type NewMediationCollectionInput = {
  mediationFileId: string
  amount: string
  collectionDate: string
  description?: string
  paymentMethod?: string
  receiptNo?: string
  currency?: string
}

export function useCreateMediationCollection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: NewMediationCollectionInput) => {
      const res = await api.post('/collections', {
        mediationFileId: data.mediationFileId,
        amount: data.amount,
        collectionDate: data.collectionDate,
        currency: data.currency || 'TRY',
        description: data.description || '',
        paymentMethod: data.paymentMethod || '',
        receiptNo: data.receiptNo || '',
      })
      return res.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['mediation-files', variables.mediationFileId, 'collections'],
      })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['statistics'] })
      toast.success('Tahsilat eklendi.')
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || 'Tahsilat eklenemedi.'
      toast.error(message)
    },
  })
}

export function useDeleteMediationCollection(mediationFileId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (collectionId: string) => api.delete(`/collections/${collectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['mediation-files', mediationFileId, 'collections'],
      })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['statistics'] })
      toast.success('Tahsilat silindi.')
    },
    onError: () => {
      toast.error('Tahsilat silinemedi.')
    },
  })
}
