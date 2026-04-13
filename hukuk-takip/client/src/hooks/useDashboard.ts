import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard')
      return res.data
    },
    staleTime: 1000 * 60 * 2, // 2 dakika cache, mutation invalidation ile yenilenir
  })
}
