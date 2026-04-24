import { useCallback, type ElementType } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  Bell,
  Briefcase,
  Calculator,
  Calendar,
  CheckSquare,
  FolderOpen,
  Gavel,
  LayoutDashboard,
  PhoneCall,
  Scale,
  Settings,
  Shield,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/axios'

// Her menu ogesi icin: route + opsiyonel prefetch meta (hangi query + URL on yuklenecek).
// Hover/touch aninda veri on cekilerek sekme gecisinde beklemeyi sifira yaklastiririz.
const navItems: Array<{
  to: string
  label: string
  icon: ElementType
  prefetch?: { queryKey: unknown[]; url: string }
}> = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, prefetch: { queryKey: ['dashboard'], url: '/dashboard' } },
  { to: '/clients', label: 'Müvekkiller', icon: Users, prefetch: { queryKey: ['clients', undefined], url: '/clients' } },
  { to: '/cases', label: 'Davalar', icon: Briefcase, prefetch: { queryKey: ['cases', undefined], url: '/cases' } },
  { to: '/tools/mediation-files', label: 'Arabuluculuk Dosyaları', icon: FolderOpen },
  { to: '/hearings', label: 'Duruşmalar', icon: Gavel, prefetch: { queryKey: ['hearings', undefined], url: '/hearings' } },
  { to: '/tasks', label: 'Görevler', icon: CheckSquare, prefetch: { queryKey: ['tasks', undefined], url: '/tasks' } },
  { to: '/consultations', label: 'Görüşmeler', icon: PhoneCall, prefetch: { queryKey: ['consultations'], url: '/consultations' } },
  { to: '/collections', label: 'Tahsilatlar', icon: Wallet, prefetch: { queryKey: ['collections', 'all', undefined], url: '/collections' } },
  { to: '/calendar', label: 'Takvim', icon: Calendar, prefetch: { queryKey: ['calendar', undefined], url: '/calendar' } },
  { to: '/notifications', label: 'Bildirimler', icon: Bell, prefetch: { queryKey: ['notifications', undefined], url: '/notifications' } },
  { to: '/statistics', label: 'İstatistikler', icon: BarChart3, prefetch: { queryKey: ['statistics'], url: '/statistics' } },
]

const toolItems: Array<{ to: string; label: string; icon: ElementType }> = [
  { to: '/tools/calculations', label: 'Hesaplamalar', icon: Calculator },
  { to: '/tools/inheritance', label: 'Miras Payı', icon: Scale },
  { to: '/tools/sentence', label: 'İnfaz Hesabı', icon: Shield },
]

function SidebarLink({
  to,
  label,
  Icon,
  onClick,
  onPrefetch,
}: {
  to: string
  label: string
  Icon: ElementType
  onClick?: () => void
  onPrefetch?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      onTouchStart={onPrefetch}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
          isActive
            ? 'bg-sidebar-active-bg text-sidebar-foreground shadow-sm'
            : 'text-sidebar-muted hover:bg-white/[0.06] hover:text-sidebar-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={16}
            className={cn(
              'flex-shrink-0 transition-colors duration-200',
              isActive ? 'text-law-gold-light' : 'text-sidebar-muted group-hover:text-sidebar-foreground/70'
            )}
          />
          <span className="truncate">{label}</span>
          {isActive && <div className="ml-auto h-4 w-1 rounded-full bg-law-gold/60" />}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const prefetch = useCallback(
    (meta?: { queryKey: unknown[]; url: string }) => {
      if (!meta) return
      qc.prefetchQuery({
        queryKey: meta.queryKey,
        queryFn: async () => (await api.get(meta.url)).data,
        staleTime: 1000 * 60 * 5,
      })
    },
    [qc]
  )
  return (
    <>
      {/* Mobil overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col overflow-hidden bg-sidebar transition-transform duration-300 ease-in-out md:relative md:z-auto md:w-[240px] md:translate-x-0 md:transition-none',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />

        <div className="relative flex items-center justify-between px-5 py-5">
          <button
            onClick={() => { onClose(); navigate('/dashboard') }}
            className="flex items-center gap-3 cursor-pointer"
          >
            <img src="/logo-sidebar.png" alt="HukukTakip" className="h-10 w-10 rounded-lg" />
            <p className="font-serif text-[18px] font-bold leading-tight tracking-tight text-sidebar-foreground">
              HukukTakip
            </p>
          </button>
          {/* Mobil kapat butonu */}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-sidebar-muted transition-colors hover:bg-white/10 hover:text-sidebar-foreground md:hidden"
            aria-label="Menüyü kapat"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mx-5 h-px bg-gradient-to-r from-law-gold/30 via-law-gold/10 to-transparent" />

        <nav className="relative flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              label={item.label}
              Icon={item.icon}
              onClick={onClose}
              onPrefetch={item.prefetch ? () => prefetch(item.prefetch) : undefined}
            />
          ))}

          <div className="mt-3 pt-3">
            <div className="mx-2 mb-2 h-px bg-sidebar-border" />
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted/60">
              Araçlar
            </p>
            {toolItems.map(({ to, label, icon: Icon }) => (
              <SidebarLink key={to} to={to} label={label} Icon={Icon} onClick={onClose} />
            ))}
          </div>
        </nav>

        <div className="relative px-3 pb-4">
          <div className="mx-2 mb-3 h-px bg-sidebar-border" />
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-active-bg text-sidebar-foreground'
                  : 'text-sidebar-muted hover:bg-white/[0.06] hover:text-sidebar-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Settings
                  size={17}
                  className={cn(
                    'transition-colors duration-200',
                    isActive ? 'text-law-gold-light' : 'text-sidebar-muted group-hover:text-sidebar-foreground/70'
                  )}
                />
                <span>Ayarlar</span>
              </>
            )}
          </NavLink>
        </div>
      </aside>
    </>
  )
}
