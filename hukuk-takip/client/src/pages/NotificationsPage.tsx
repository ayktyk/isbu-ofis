import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from '@/hooks/useNotifications'
import { formatRelativeDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  CalendarClock,
  Scale,
  ListChecks,
  AlertTriangle,
  Info,
} from 'lucide-react'

const typeIcon: Record<string, React.ElementType> = {
  hearing_reminder: CalendarClock,
  task_due: ListChecks,
  case_update: Scale,
  system: Info,
}

const typeBg: Record<string, string> = {
  hearing_reminder: 'bg-purple-500/10 text-purple-500',
  task_due: 'bg-amber-500/10 text-amber-500',
  case_update: 'bg-blue-500/10 text-blue-500',
  system: 'bg-muted text-muted-foreground',
}

export default function NotificationsPage() {
  const { data, isLoading, isError } = useNotifications()
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()
  const deleteNotification = useDeleteNotification()

  const notifications = Array.isArray(data) ? data : []
  const unreadCount = notifications.filter((n: any) => !n.isRead).length

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Bildirimler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : 'Tüm bildirimler okundu'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <CheckCheck className="h-4 w-4" />
            Tümünü okundu işaretle
          </button>
        )}
      </div>

      {/* Yükleniyor */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex gap-3 p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Hata */}
      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">Bildirimler yüklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {/* Liste */}
      {!isLoading && !isError && (
        <>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BellOff className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-muted-foreground">Bildirim yok</h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Yeni bildirimler burada görünecek
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification: any) => {
                const Icon = typeIcon[notification.type] || Bell
                const iconClass = typeBg[notification.type] || 'bg-gray-100 text-gray-600'

                return (
                  <Card
                    key={notification.id}
                    className={`transition-colors ${
                      !notification.isRead ? 'border-law-accent/30 bg-law-accent/5' : ''
                    }`}
                  >
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${iconClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'}`}>
                              {notification.title}
                            </p>
                            {notification.message && (
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {notification.message}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatRelativeDate(notification.createdAt)}
                            </p>
                          </div>

                          <div className="flex flex-shrink-0 items-center gap-1">
                            {!notification.isRead && (
                              <button
                                onClick={() => markAsRead.mutate(notification.id)}
                                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Okundu işaretle"
                              >
                                <CheckCheck className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification.mutate(notification.id)}
                              className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                              title="Sil"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Okunmamış noktası */}
                      {!notification.isRead && (
                        <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-law-accent" />
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
