import { useState, useCallback, useEffect, Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileBottomNav from './MobileBottomNav'
import ActionSearchBar from '@/components/shared/ActionSearchBar'
import { InlinePageLoader } from '@/App'
import { api } from '@/lib/axios'

// iOS Safari requestIdleCallback desteklemiyor — setTimeout fallback
type IdleHandle = number | ReturnType<typeof setTimeout>

function scheduleIdle(cb: () => void, timeout = 3000): IdleHandle {
  if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
    return (window as any).requestIdleCallback(cb, { timeout })
  }
  return setTimeout(cb, 1500)
}

function cancelIdle(handle: IdleHandle) {
  if (typeof window !== 'undefined' && typeof (window as any).cancelIdleCallback === 'function') {
    try {
      ;(window as any).cancelIdleCallback(handle)
      return
    } catch {}
  }
  clearTimeout(handle as ReturnType<typeof setTimeout>)
}

// Prefetch secondary data after initial render is complete (not blocking)
function usePrefetchCoreData() {
  const qc = useQueryClient()

  useEffect(() => {
    const id = scheduleIdle(() => {
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
    }, 3000)

    return () => cancelIdle(id)
  }, [qc])
}

// Render Free plan bosta kalinca servis uyur (30-60sn soguk kalkis).
// Kullanici sekmesi acikken her 14 dakikada /api/health pingle — uyku olmasin.
// Sekmesi gizliyken ping etmez (gereksiz trafik/batarya).
function useBackendKeepWarm() {
  useEffect(() => {
    let stopped = false

    const ping = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      // fire-and-forget — hata olsa sessiz gec
      api.get('/health', { timeout: 8000 }).catch(() => {})
    }

    // Sayfa yuklendiginde hemen bir warmup pingi at (API cache persisted ama
    // backend uykuda olabilir; arka planda uyandir).
    ping()

    const interval = setInterval(() => {
      if (!stopped) ping()
    }, 14 * 60 * 1000) // 14 dakika

    // Sayfa gizlenip tekrar gorunur oldugunda pingle (RAM'den donuste backend soguk olabilir)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') ping()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopped = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  usePrefetchCoreData()
  useBackendKeepWarm()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={toggleSidebar} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-[calc(64px+env(safe-area-inset-bottom)+16px)] sm:p-4 md:p-6 md:pb-6">
          {/* Ic Suspense: sekme degistiginde layout kalir, yalnizca icerik
              alani skeleton gosterir — bos/titrek ekran olmaz. */}
          <Suspense fallback={<InlinePageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <MobileBottomNav />
      <ActionSearchBar />
    </div>
  )
}
