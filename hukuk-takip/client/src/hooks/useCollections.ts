import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

// GET /api/collections — userin tum tahsilatlari (filter verilmezse hepsi).
// Backend caseId / mediationFileId / source parametrelerini destekler ama bu
// hook tum listeyi cekmek icindir; dava/dosya ici detay icin zaten useCases
// ve useMediationFiles altinda daralt filtrli hook'lar var.
export function useAllCollections(params?: {
  source?: 'case' | 'mediation'
}) {
  return useQuery({
    queryKey: ['collections', 'all', params],
    queryFn: async () => {
      const res = await api.get('/collections', { params })
      return res.data
    },
  })
}
