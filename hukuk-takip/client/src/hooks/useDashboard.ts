import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

// Eski dashboard endpoint — geriye uyum için saklanıyor, ama DashboardPage artık
// useDashboardSummary kullanmalı (tek istekte her şeyi çeker).
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary')
      return res.data
    },
    staleTime: 1000 * 60 * 2,
  })
}

// Yeni: tek roundtrip — dashboard + thisMonth income kırılımı + consultation stats
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary')
      return res.data
    },
    staleTime: 1000 * 60 * 2,
  })
}
