import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
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

// Mobil drawer için soldan-sağa kenar swipe — Android/iOS native pattern.
// Sidebar kapalıyken ekranın sol kenarında (ilk 24px) parmak basılır,
// sağa doğru en az 60px kayarsa sidebar açılır. Açıkken sağdan sola
// kayma kapatır. Yatay hareket dikeyden belirgin daha fazla olmalı —
// scroll'a karışmasın.
function useSidebarSwipe(open: boolean, onOpen: () => void, onClose: () => void) {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const moved = useRef(false)

  useEffect(() => {
    const EDGE_THRESHOLD = 24
    const OPEN_THRESHOLD = 60
    const CLOSE_THRESHOLD = 60
    const MAX_VERTICAL_DRIFT = 50

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      moved.current = false
      // Sidebar açıkken her yerden swipe close kabul et
      if (open) {
        startX.current = t.clientX
        startY.current = t.clientY
        return
      }
      // Sidebar kapalıyken sadece sol kenardan başlayan swipe sayılır
      if (t.clientX <= EDGE_THRESHOLD) {
        startX.current = t.clientX
        startY.current = t.clientY
      } else {
        startX.current = null
        startY.current = null
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (startX.current === null || startY.current === null) return
      const t = e.touches[0]
      if (!t) return
      const dx = t.clientX - startX.current
      const dy = Math.abs(t.clientY - startY.current)
      // Dikey hareket baskın → kullanıcı scroll'luyor, swipe iptal
      if (dy > MAX_VERTICAL_DRIFT && Math.abs(dx) < dy) {
        startX.current = null
        startY.current = null
        return
      }
      if (!open && dx >= OPEN_THRESHOLD) {
        moved.current = true
        onOpen()
        startX.current = null
        startY.current = null
      } else if (open && dx <= -CLOSE_THRESHOLD) {
        moved.current = true
        onClose()
        startX.current = null
        startY.current = null
      }
    }

    const onTouchEnd = () => {
      startX.current = null
      startY.current = null
      moved.current = false
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [open, onOpen, onClose])
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const openSidebar = useCallback(() => setSidebarOpen(true), [])

  usePrefetchCoreData()
  useBackendKeepWarm()
  useSidebarSwipe(sidebarOpen, openSidebar, closeSidebar)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={toggleSidebar} />
        <main id="app-scroll-main" className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-[calc(64px+env(safe-area-inset-bottom)+16px)] sm:p-4 md:p-6 md:pb-6">
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
