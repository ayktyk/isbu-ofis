import type { ElementType } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Bell,
  Briefcase,
  Calculator,
  Calendar,
  CheckSquare,
  FileText,
  Gavel,
  LayoutDashboard,
  Scale,
  Settings,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Muvekkiller', icon: Users },
  { to: '/cases', label: 'Davalar', icon: Briefcase },
  { to: '/hearings', label: 'Durusmalar', icon: Gavel },
  { to: '/tasks', label: 'Gorevler', icon: CheckSquare },
  { to: '/calendar', label: 'Takvim', icon: Calendar },
  { to: '/notifications', label: 'Bildirimler', icon: Bell },
]

const toolItems = [
  { to: '/tools/calculations', label: 'Hesaplamalar', icon: Calculator },
  { to: '/tools/prompts', label: 'AI Sablonlari', icon: Sparkles },
  { to: '/tools/inheritance', label: 'Miras Payi', icon: Scale },
  { to: '/tools/sentence', label: 'Infaz Hesabi', icon: Shield },
]

const mediationItems = [
  { to: '/tools/mediation', label: 'Arabuluculuk', icon: FileText },
]

function SidebarLink({
  to,
  label,
  Icon,
}: {
  to: string
  label: string
  Icon: ElementType
}) {
  return (
    <NavLink
      to={to}
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
          <span>{label}</span>
          {isActive && <div className="ml-auto h-4 w-1 rounded-full bg-law-gold/60" />}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  return (
    <aside className="relative flex w-[240px] flex-shrink-0 flex-col overflow-hidden bg-sidebar">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />

      <div className="relative flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-law-gold/25 bg-law-gold/15">
          <Gavel className="h-[18px] w-[18px] text-law-gold-light" />
        </div>
        <div>
          <p className="font-serif text-[15px] font-semibold leading-tight tracking-tight text-sidebar-foreground">
            HukukTakip
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-sidebar-muted">
            Buro Yonetimi
          </p>
        </div>
      </div>

      <div className="mx-5 h-px bg-gradient-to-r from-law-gold/30 via-law-gold/10 to-transparent" />

      <nav className="relative flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map(({ to, label, icon: Icon }) => (
          <SidebarLink key={to} to={to} label={label} Icon={Icon} />
        ))}

        <div className="mt-3 pt-3">
          <div className="mx-2 mb-2 h-px bg-sidebar-border" />
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted/60">
            Araclar
          </p>
          {toolItems.map(({ to, label, icon: Icon }) => (
            <SidebarLink key={to} to={to} label={label} Icon={Icon} />
          ))}

          <p className="mb-1.5 mt-4 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted/60">
            Arabuluculuk Dosyalari
          </p>
          {mediationItems.map(({ to, label, icon: Icon }) => (
            <SidebarLink key={to} to={to} label={label} Icon={Icon} />
          ))}
        </div>
      </nav>

      <div className="relative px-3 pb-4">
        <div className="mx-2 mb-3 h-px bg-sidebar-border" />
        <NavLink
          to="/settings"
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
  )
}
