import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  CheckSquare,
  Bell,
  Settings,
  Gavel,
  Calculator,
  Sparkles,
  Scale,
  FileText,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Müvekkiller', icon: Users },
  { to: '/cases', label: 'Davalar', icon: Briefcase },
  { to: '/hearings', label: 'Duruşmalar', icon: Gavel },
  { to: '/tasks', label: 'Görevler', icon: CheckSquare },
  { to: '/calendar', label: 'Takvim', icon: Calendar },
  { to: '/notifications', label: 'Bildirimler', icon: Bell },
]

const toolItems = [
  { to: '/tools/calculations', label: 'Hesaplamalar', icon: Calculator },
  { to: '/tools/prompts', label: 'AI Şablonları', icon: Sparkles },
  { to: '/tools/inheritance', label: 'Miras Payı', icon: Scale },
  { to: '/tools/mediation', label: 'Arabuluculuk', icon: FileText },
  { to: '/tools/sentence', label: 'İnfaz Hesabı', icon: Shield },
]

export default function Sidebar() {
  return (
    <aside className="w-[240px] flex-shrink-0 bg-sidebar flex flex-col relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="relative flex items-center gap-3 px-5 py-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-law-gold/15 border border-law-gold/25">
          <Gavel className="w-[18px] h-[18px] text-law-gold-light" />
        </div>
        <div>
          <p className="text-sidebar-foreground font-serif text-[15px] font-semibold tracking-tight leading-tight">
            HukukTakip
          </p>
          <p className="text-sidebar-muted text-[11px] tracking-wide uppercase mt-0.5">
            Büro Yönetimi
          </p>
        </div>
      </div>

      {/* Separator */}
      <div className="mx-5 h-px bg-gradient-to-r from-law-gold/30 via-law-gold/10 to-transparent" />

      {/* Navigation */}
      <nav className="relative flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-active-bg text-sidebar-foreground shadow-sm'
                  : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/[0.06]'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={17}
                  className={cn(
                    'transition-colors duration-200 flex-shrink-0',
                    isActive ? 'text-law-gold-light' : 'text-sidebar-muted group-hover:text-sidebar-foreground/70'
                  )}
                />
                <span>{label}</span>
                {isActive && (
                  <div className="ml-auto w-1 h-4 rounded-full bg-law-gold/60" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Araçlar grubu */}
        <div className="pt-3 mt-3">
          <div className="mx-2 mb-2 h-px bg-sidebar-border" />
          <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest uppercase text-sidebar-muted/60">
            Araçlar
          </p>
          {toolItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-active-bg text-sidebar-foreground shadow-sm'
                    : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/[0.06]'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={16}
                    className={cn(
                      'transition-colors duration-200 flex-shrink-0',
                      isActive ? 'text-law-gold-light' : 'text-sidebar-muted group-hover:text-sidebar-foreground/70'
                    )}
                  />
                  <span>{label}</span>
                  {isActive && (
                    <div className="ml-auto w-1 h-4 rounded-full bg-law-gold/60" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Bottom — Settings */}
      <div className="relative px-3 pb-4">
        <div className="mx-2 mb-3 h-px bg-sidebar-border" />
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200',
              isActive
                ? 'bg-sidebar-active-bg text-sidebar-foreground'
                : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/[0.06]'
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
