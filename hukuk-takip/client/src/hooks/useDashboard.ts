import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

// Dashboard verisi tek roundtrip ile çekilir. Cache hit varsa anında render
// edilir; arka planda tazelenir (refetchOnMount: false). Bu sayede tab değişimleri
// veya geri tuşu ile dashboard'a dönüşler bekletilmez.
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary')
      return res.data
    },
    staleTime: 1000 * 60 * 5,       // 5 dk taze say
    gcTime: 1000 * 60 * 30,          // 30 dk cache'de tut
    refetchOnMount: false,           // Cache varsa hemen göster, refetch etme
    refetchOnWindowFocus: false,
  })
}

// Geriye uyum için saklanıyor — aynı endpoint'i farklı queryKey ile çağırır.
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary')
      return res.data
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
}
