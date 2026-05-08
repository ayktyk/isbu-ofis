import { useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Briefcase, Calendar, CheckSquare, LayoutDashboard, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/axios'

// Prefetch için kullanılan queryKey'ler ilgili hook'lardakilerle BIRE BIR aynı
// olmalı, aksi halde cache hit olmaz ve sayfa yine boş yüklenir.
//   useDashboard      → ['dashboard']
//   useCases          → ['cases', undefined]  (params undefined default)
//   useCalendar       → ['calendar', undefined]  (varsa) — biz query çağırmıyorsak prefetch yararsız, atlanır
//   useTasks          → ['tasks', undefined]
//   useClients        → ['clients', undefined]
// Dashboard endpoint'i /dashboard/summary; diğerleri liste endpoint'leri.
type NavItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  prefetch?: { queryKey: unknown[]; url: string }
}

const items: NavItem[] = [
  { to: '/dashboard', label: 'Panel', icon: LayoutDashboard, prefetch: { queryKey: ['dashboard'], url: '/dashboard/summary' } },
  { to: '/cases', label: 'Davalar', icon: Briefcase, prefetch: { queryKey: ['cases', undefined], url: '/cases' } },
  { to: '/calendar', label: 'Takvim', icon: Calendar }, // takvim sayfası tarihe göre fetch — liste prefetch'i anlamlı değil
  { to: '/tasks', label: 'Görevler', icon: CheckSquare, prefetch: { queryKey: ['tasks', undefined], url: '/tasks' } },
  { to: '/clients', label: 'Müvekkil', icon: Users, prefetch: { queryKey: ['clients', undefined], url: '/clients' } },
]

// Aktif sekmeye tekrar basıldığında ana scroll konteynerini yumuşakça başa kaydır.
// iOS/Android'in standart "tap active tab to scroll to top" davranışı.
function scrollAppContainerToTop() {
  const main = document.getElementById('app-scroll-main')
  if (main) {
    main.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    // Fallback: bazı eski tarayıcılarda ana scroll window olabilir.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

export default function MobileBottomNav() {
  const qc = useQueryClient()
  const location = useLocation()

  const prefetch = useCallback((queryKey: unknown[], url: string) => {
    qc.prefetchQuery({
      queryKey,
      queryFn: async () => {
        const res = await api.get(url)
        return res.data
      },
      staleTime: 1000 * 60 * 5,
    })
  }, [qc])

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, to: string) => {
      // Zaten aktif sekmedeyiz → navigate yerine başa kaydır.
      // Tam path eşleşmesi: /cases'de iken tıklarsan kaydırır,
      // /cases/123 detay sayfasındaysan /cases listesine navigate olur (varsayılan).
      if (location.pathname === to) {
        event.preventDefault()
        scrollAppContainerToTop()
      }
    },
    [location.pathname]
  )

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-around px-1">
        {items.map(({ to, label, icon: Icon, prefetch: prefetchInfo }) => (
          <NavLink
            key={to}
            to={to}
            onTouchStart={() => {
              if (prefetchInfo) prefetch(prefetchInfo.queryKey, prefetchInfo.url)
            }}
            onClick={(event) => handleClick(event, to)}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-all active:scale-95',
                isActive
                  ? 'text-law-accent'
                  : 'text-muted-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-law-accent" />
                )}
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
                  isActive ? 'bg-law-accent/10' : ''
                )}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                <span className={cn(isActive ? 'font-semibold' : '')}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
