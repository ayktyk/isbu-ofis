import { Bell, LogOut, Menu, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { getInitials } from '@/lib/utils'
import { useUnreadCount } from '@/hooks/useNotifications'
import { clearCachedUser } from '@/lib/authCache'

export default function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await api.get('/auth/me')
      return res.data
    },
    staleTime: 1000 * 60 * 5,
  })

  const unreadCount = useUnreadCount()

  const logoutMutation = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      clearCachedUser()
      queryClient.clear()
      navigate('/login')
    },
  })

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-3 sm:px-6">
      <div className="flex items-center gap-2">
        {/* Mobil hamburger menu */}
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:hidden"
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>

        {/* Search trigger */}
        <button
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
          }}
          className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <Search size={14} />
          <span className="hidden sm:inline">Ara...</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            Ctrl+K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Bildirim butonu */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative cursor-pointer rounded-lg p-2 text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-foreground"
          aria-label="Bildirimler"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-law-danger px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Separator */}
        <div className="mx-0.5 hidden h-7 w-px bg-border sm:block" />

        {/* Kullanici */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-law-primary text-[11px] font-semibold tracking-wide text-white">
            {getInitials(user?.fullName)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-tight text-foreground">
              {user?.fullName || 'Kullanici'}
            </p>
            <p className="text-[11px] text-muted-foreground">{user?.email}</p>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="ml-0.5 cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-foreground"
            title="Cikis yap"
            aria-label="Cikis yap"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}
