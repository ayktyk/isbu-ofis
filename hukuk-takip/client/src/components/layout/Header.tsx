import { Bell, LogOut, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { getInitials } from '@/lib/utils'
import { useUnreadCount } from '@/hooks/useNotifications'

export default function Header() {
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
      queryClient.clear()
      navigate('/login')
    },
  })

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0">
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

      <div className="flex items-center gap-2">
        {/* Bildirim butonu */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 cursor-pointer"
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
        <div className="w-px h-7 bg-border mx-1" />

        {/* Kullanıcı */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-law-primary flex items-center justify-center text-white text-[11px] font-semibold tracking-wide">
            {getInitials(user?.fullName)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-tight">
              {user?.fullName || 'Kullanıcı'}
            </p>
            <p className="text-[11px] text-muted-foreground">{user?.email}</p>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 ml-1 cursor-pointer"
            title="Çıkış yap"
            aria-label="Çıkış yap"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}
