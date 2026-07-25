import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/axios'

export interface FeeInstallment {
  id: string
  caseId: string
  seq: number
  amount: string
  dueDate: string
  status: 'pending' | 'paid' | 'partial'
  collectionId: string | null
  note: string | null
}

export function useFeeInstallments(caseId: string | undefined) {
  return useQuery({
    queryKey: ['cases', caseId, 'fee-installments'],
    queryFn: async () => {
      const res = await api.get(`/cases/${caseId}/fee-installments`)
      return res.data as FeeInstallment[]
    },
    enabled: !!caseId,
  })
}

export function useCreateFeeInstallment(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      seq?: number
      amount: string
      dueDate: string
      note?: string
    }) => (await api.post(`/cases/${caseId}/fee-installments`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases', caseId, 'fee-installments'] })
    },
    onError: () => toast.error('Taksit eklenemedi.'),
  })
}

export function useUpdateFeeInstallment(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      (await api.put(`/fee-installments/${id}`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases', caseId, 'fee-installments'] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
    onError: () => toast.error('Taksit güncellenemedi.'),
  })
}

/**
 * Sunucu tarafinda ARSIVLER — satir silinmez, gerekirse geri alinabilir.
 * (Veri koruma kurali: fiziksel DELETE kod yolu yok.)
 */
export function useArchiveFeeInstallment(caseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/fee-installments/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases', caseId, 'fee-installments'] })
      toast.success('Taksit kaldırıldı.')
    },
    onError: () => toast.error('Taksit kaldırılamadı.'),
  })
}
