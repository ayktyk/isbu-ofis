import { useNavigate } from 'react-router-dom'
import { useHearings } from '@/hooks/useHearings'
import {
  formatDateTime,
  formatRelativeDate,
  isOverdue,
  hearingResultLabels,
} from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CalendarClock, AlertTriangle } from 'lucide-react'

const resultVariant: Record<string, 'success' | 'warning' | 'danger' | 'secondary'> = {
  completed: 'success',
  postponed: 'warning',
  cancelled: 'danger',
  pending: 'secondary',
}

export default function HearingsPage() {
  const navigate = useNavigate()
  const { data: hearings, isLoading, isError } = useHearings({ upcoming: true })

  const list = Array.isArray(hearings) ? hearings : hearings?.data || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Duruşmalar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tüm yaklaşan ve geçmiş duruşmalar
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">Duruşma listesi yüklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && (
        <>
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarClock className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-muted-foreground">Duruşma bulunmuyor</h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Dava detayından duruşma ekleyebilirsiniz
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">Dava / Müvekkil</th>
                    <th className="hidden px-4 py-3 md:table-cell">Mahkeme</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Salon</th>
                    <th className="px-4 py-3">Sonuç</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((h: any) => {
                    const overdue = isOverdue(h.hearingDate) && (!h.result || h.result === 'pending')
                    return (
                      <tr
                        key={h.id}
                        onClick={() => h.caseId && navigate(`/cases/${h.caseId}`)}
                        className="cursor-pointer transition-colors hover:bg-muted/50 even:bg-muted/20"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {overdue && <span className="h-2 w-2 rounded-full bg-red-500" />}
                            <div>
                              <p className={`font-medium ${overdue ? 'text-red-600' : ''}`}>
                                {formatDateTime(h.hearingDate)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatRelativeDate(h.hearingDate)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{h.caseTitle || '—'}</p>
                          <p className="text-xs text-muted-foreground">{h.clientName || ''}</p>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span className="text-muted-foreground">{h.courtName || '—'}</span>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {h.courtRoom ? (
                            <Badge variant="outline">{h.courtRoom}</Badge>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={resultVariant[h.result] || 'secondary'}>
                            {hearingResultLabels[h.result] || h.result || 'Beklemede'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
