import { useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Briefcase, Calendar, CheckSquare, LayoutDashboard, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/axios'

const items = [
  { to: '/dashboard', label: 'Panel', icon: LayoutDashboard, queryKey: 'dashboard', api: '/dashboard' },
  { to: '/cases', label: 'Davalar', icon: Briefcase, queryKey: 'cases', api: '/cases' },
  { to: '/calendar', label: 'Takvim', icon: Calendar, queryKey: 'calendar', api: '/calendar' },
  { to: '/tasks', label: 'Görevler', icon: CheckSquare, queryKey: 'tasks', api: '/tasks' },
  { to: '/clients', label: 'Müvekkil', icon: Users, queryKey: 'clients', api: '/clients' },
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

  const prefetch = useCallback((queryKey: string, url: string) => {
    qc.prefetchQuery({
      queryKey: [queryKey, undefined] as unknown[],
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
        {items.map(({ to, label, icon: Icon, queryKey, api: apiUrl }) => (
          <NavLink
            key={to}
            to={to}
            onTouchStart={() => prefetch(queryKey, apiUrl)}
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
