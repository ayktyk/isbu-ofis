import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard')
      return res.data
    },
    staleTime: 0, // invalidation sonrasi aninda yenilensin
  })
}
