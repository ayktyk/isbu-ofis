import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

export function useStatistics() {
  return useQuery({
    queryKey: ['statistics'],
    queryFn: async () => {
      const res = await api.get('/statistics')
      return res.data
    },
    staleTime: 1000 * 60 * 5,
  })
}
