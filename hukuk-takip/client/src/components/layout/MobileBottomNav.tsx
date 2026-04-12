import { NavLink } from 'react-router-dom'
import { Briefcase, Calendar, CheckSquare, LayoutDashboard, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { to: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { to: '/cases', label: 'Davalar', icon: Briefcase },
  { to: '/calendar', label: 'Takvim', icon: Calendar },
  { to: '/tasks', label: 'Gorevler', icon: CheckSquare },
  { to: '/clients', label: 'Muvekkil', icon: Users },
]

export default function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-around">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-law-accent'
                  : 'text-muted-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
      {/* Safe area for phones with gesture bar */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
