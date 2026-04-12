import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import type { CreateNoteInput, UpdateNoteInput } from '@hukuk-takip/shared'

export function useCreateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateNoteInput) => api.post('/notes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      toast.success('Not eklendi.')
    },
    onError: () => {
      toast.error('Not eklenemedi.')
    },
  })
}

export function useUpdateNote(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateNoteInput) => api.put(`/notes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      toast.success('Not güncellendi.')
    },
    onError: () => {
      toast.error('Not güncellenemedi.')
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      toast.success('Not silindi.')
    },
    onError: () => {
      toast.error('Not silinemedi.')
    },
  })
}
