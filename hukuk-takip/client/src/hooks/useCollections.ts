import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

// GET /api/collections — userin tum tahsilatlari (filter verilmezse hepsi).
// Backend caseId / mediationFileId / source parametrelerini destekler ama bu
// hook tum listeyi cekmek icindir; dava/dosya ici detay icin zaten useCases
// ve useMediationFiles altinda daralt filtrli hook'lar var.
export function useAllCollections(params?: {
  source?: 'case' | 'mediation' | 'cmk'
}) {
  return useQuery({
    queryKey: ['collections', 'all', params],
    queryFn: async () => {
      const res = await api.get('/collections', { params })
      return res.data
    },
  })
}

export interface OutstandingRow {
  id: string
  title: string
  clientName: string | null
  contractedFee: string | null
  totalCollected: string
  remaining: string
  source: 'case' | 'mediation'
  isCmkAssignment?: boolean
  status?: string
}

// Bekleyen tahsilatlar — anlasilan ucreti girilmis ama henuz tam tahsil
// edilmemis dava ve arabuluculuk dosyalari.
//
// Sunucu tarafinda Dashboard ve Istatistikler ile AYNI yardimci fonksiyonlari
// kullanir; uc ekran arasinda rakam farki olmaz.
export function useOutstandingCollections() {
  return useQuery({
    queryKey: ['collections', 'outstanding'],
    queryFn: async () => {
      const res = await api.get('/collections/outstanding')
      return res.data as { cases: OutstandingRow[]; mediations: OutstandingRow[] }
    },
    staleTime: 1000 * 60 * 2,
  })
}
