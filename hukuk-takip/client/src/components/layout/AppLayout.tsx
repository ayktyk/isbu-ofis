import { useState, useCallback, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileBottomNav from './MobileBottomNav'
import ActionSearchBar from '@/components/shared/ActionSearchBar'
import { api } from '@/lib/axios'

// Prefetch secondary data after initial render is complete (not blocking)
function usePrefetchCoreData() {
  const qc = useQueryClient()

  useEffect(() => {
    // Wait for initial paint + idle time before prefetching
    const id = requestIdleCallback(() => {
      const prefetch = (key: unknown[], url: string) => {
        qc.prefetchQuery({
          queryKey: key,
          queryFn: async () => {
            const res = await api.get(url)
            return res.data
          },
          staleTime: 1000 * 60 * 5,
        })
      }

      prefetch(['cases', undefined], '/cases')
      prefetch(['clients', undefined], '/clients')
      prefetch(['tasks', undefined], '/tasks')
    }, { timeout: 3000 })

    return () => cancelIdleCallback(id)
  }, [qc])
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  usePrefetchCoreData()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={toggleSidebar} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-20 sm:p-4 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
      <ActionSearchBar />
    </div>
  )
}
