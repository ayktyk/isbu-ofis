import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import type {
  CreateDiaryEntryInput,
  UpdateDiaryEntryInput,
} from '@hukuk-takip/shared'

export type DiaryEntryType =
  | 'manual'
  | 'hearing_added'
  | 'hearing_updated'
  | 'hearing_completed'
  | 'task_added'
  | 'task_completed'
  | 'expense_added'
  | 'collection_added'
  | 'document_added'
  | 'status_changed'
  | 'note_added'

export interface DiaryEntry {
  id: string
  caseId: string
  userId: string
  entryType: DiaryEntryType
  title: string | null
  content: string | null
  nextStep: string | null
  nextStepDueDate: string | null
  nextStepDone: boolean
  occurredAt: string
  linkedEntityType: string | null
  linkedEntityId: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface OpenNextStep {
  id: string
  nextStep: string | null
  nextStepDueDate: string | null
  occurredAt: string
  entryType: DiaryEntryType
}

export function useCaseDiary(caseId: string | undefined) {
  return useQuery({
    queryKey: ['cases', caseId, 'diary'],
    queryFn: async () => {
      const res = await api.get<DiaryEntry[]>(`/cases/${caseId}/diary`)
      return res.data
    },
    enabled: !!caseId,
    staleTime: 1000 * 30,
  })
}

export function useCaseNextStep(caseId: string | undefined) {
  return useQuery({
    queryKey: ['cases', caseId, 'next-step'],
    queryFn: async () => {
      const res = await api.get<OpenNextStep | null>(`/cases/${caseId}/next-step`)
      return res.data
    },
    enabled: !!caseId,
    staleTime: 1000 * 30,
  })
}

function invalidateDiary(queryClient: ReturnType<typeof useQueryClient>, caseId?: string) {
  queryClient.invalidateQueries({ queryKey: ['cases', caseId, 'diary'] })
  queryClient.invalidateQueries({ queryKey: ['cases', caseId, 'next-step'] })
  queryClient.invalidateQueries({ queryKey: ['cases', caseId, 'detail'] })
}

export function useCreateDiaryEntry(caseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDiaryEntryInput) =>
      api.post(`/cases/${caseId}/diary`, data),
    onSuccess: () => {
      invalidateDiary(queryClient, caseId)
      toast.success('Günlük girdisi eklendi.')
    },
    onError: () => toast.error('Günlük girdisi eklenemedi.'),
  })
}

export function useUpdateDiaryEntry(caseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ entryId, data }: { entryId: string; data: UpdateDiaryEntryInput }) =>
      api.put(`/diary/${entryId}`, data),
    onSuccess: () => {
      invalidateDiary(queryClient, caseId)
      toast.success('Günlük girdisi güncellendi.')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || 'Günlük girdisi güncellenemedi.'
      toast.error(msg)
    },
  })
}

export function useToggleNextStepDone(caseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ entryId, done }: { entryId: string; done: boolean }) =>
      api.patch(`/diary/${entryId}/next-step`, { done }),
    onSuccess: () => invalidateDiary(queryClient, caseId),
    onError: () => toast.error('Sonraki adım durumu güncellenemedi.'),
  })
}

export function useDeleteDiaryEntry(caseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entryId: string) => api.delete(`/diary/${entryId}`),
    onSuccess: () => {
      invalidateDiary(queryClient, caseId)
      toast.success('Günlük girdisi arşivlendi.')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || 'Günlük girdisi silinemedi.'
      toast.error(msg)
    },
  })
}
