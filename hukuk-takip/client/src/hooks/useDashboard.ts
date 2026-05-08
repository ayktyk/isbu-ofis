import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

// Dashboard verisi tek roundtrip ile çekilir.
// staleTime: 5 dk → cache taze sayılır, sayfa geçişlerinde mount'ta refetch yok (hızlı).
// invalidateQueries('dashboard') stale olarak işaretler → bir sonraki mount'ta
// otomatik refetch tetiklenir (mediation/case tahsilat eklenince dashboard'a
// dönüş güncel veriyi gösterir).
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary')
      return res.data
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  })
}
