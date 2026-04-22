import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import type { CreateCaseInput, UpdateCaseInput } from '@hukuk-takip/shared'

export function useCases(params?: {
  search?: string
  statusGroup?: string
  status?: string
  caseType?: string
  page?: number
  pageSize?: number
}) {
  return useQuery({
    queryKey: ['cases', params],
    queryFn: async () => {
      const res = await api.get('/cases', { params })
      return res.data
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  })
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: ['cases', id],
    queryFn: async () => {
      const res = await api.get(`/cases/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

// Tek roundtrip — dava + ilişkili tüm veri
export function useCaseDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['cases', id, 'detail'],
    queryFn: async () => {
      const res = await api.get(`/cases/${id}/detail`)
      return res.data as {
        case: any
        hearings: any[]
        tasks: any[]
        expenses: any[]
        collections: any[]
        notes: any[]
        documents: any[]
      }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  })
}

export function useCaseHearings(id: string | undefined) {
  return useQuery({
    queryKey: ['cases', id, 'hearings'],
    queryFn: async () => {
      const res = await api.get(`/cases/${id}/hearings`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCaseTasks(id: string | undefined) {
  return useQuery({
    queryKey: ['cases', id, 'tasks'],
    queryFn: async () => {
      const res = await api.get(`/cases/${id}/tasks`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCaseExpenses(id: string | undefined) {
  return useQuery({
    queryKey: ['cases', id, 'expenses'],
    queryFn: async () => {
      const res = await api.get(`/cases/${id}/expenses`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCaseCollections(id: string | undefined) {
  return useQuery({
    queryKey: ['cases', id, 'collections'],
    queryFn: async () => {
      const res = await api.get(`/cases/${id}/collections`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCaseNotes(id: string | undefined) {
  return useQuery({
    queryKey: ['cases', id, 'notes'],
    queryFn: async () => {
      const res = await api.get(`/cases/${id}/notes`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCaseDocuments(id: string | undefined) {
  return useQuery({
    queryKey: ['cases', id, 'documents'],
    queryFn: async () => {
      const res = await api.get(`/cases/${id}/documents`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCreateDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { caseId: string; files: File[]; description?: string }) => {
      const formData = new FormData()
      formData.append('caseId', data.caseId)
      data.files.forEach((file) => {
        formData.append('files', file)
      })
      if (data.description?.trim()) {
        formData.append('description', data.description.trim())
      }

      const res = await api.post('/documents', formData)

      return res.data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cases', variables.caseId, 'documents'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      const uploadedCount = Number(data?.uploadedCount || variables.files.length || 0)
      toast.success(
        uploadedCount > 1 ? `${uploadedCount} belge yuklendi.` : 'Belge yuklendi.'
      )
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Belge yuklenemedi.'
      toast.error(message)
    },
  })
}

export function useDeleteDocument(caseId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['cases', caseId, 'documents'] })
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Belge silindi.')
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Belge silinemedi.'
      toast.error(message)
    },
  })
}

export function useCreateCase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCaseInput) => api.post('/cases', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Dava oluşturuldu.')
    },
    onError: () => {
      toast.error('Dava oluşturulamadı.')
    },
  })
}

export function useUpdateCase(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateCaseInput) => api.put(`/cases/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Dava güncellendi.')
    },
    onError: () => {
      toast.error('Dava güncellenemedi.')
    },
  })
}

export function useDeleteCase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/cases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Dava silindi.')
    },
    onError: () => {
      toast.error('Dava silinemedi.')
    },
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/expenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Masraf eklendi.')
    },
    onError: () => { toast.error('Masraf eklenemedi.') },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Masraf silindi.')
    },
    onError: () => { toast.error('Masraf silinemedi.') },
  })
}

export function useCreateCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/collections', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Tahsilat eklendi.')
    },
    onError: () => { toast.error('Tahsilat eklenemedi.') },
  })
}

export function useDeleteCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/collections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Tahsilat silindi.')
    },
    onError: () => { toast.error('Tahsilat silinemedi.') },
  })
}
