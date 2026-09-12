import type { CaseTrackingSummary } from '@hukuk-takip/shared'
import { formatDate, formatDateTime } from '@/lib/utils'

export default function CaseTrackingPreview({ tracking, status }: { tracking: CaseTrackingSummary; status: string }) {
  const finished = ['won', 'lost', 'settled', 'closed'].includes(status)
  return <div className="space-y-2 text-sm">
    {tracking.overdueCount > 0 && <p className="font-semibold text-red-700">{tracking.overdueCount} geciken iş</p>}
    {tracking.nextWork ? <div>
      <p className="line-clamp-2 break-words font-medium">Sırada: {tracking.nextWork.title}</p>
      <p className="text-xs text-muted-foreground">{tracking.nextWork.kind === 'deadline' ? 'Süreli iş' : tracking.nextWork.kind === 'diary' ? 'Günlük adımı' : 'Görev'} · {tracking.nextWork.dueDate ? formatDate(tracking.nextWork.dueDate) : 'Tarih belirtilmemiş'}</p>
    </div> : <p className={finished ? 'text-muted-foreground' : 'text-amber-700'}>{finished ? 'Açık iş kaydı yok.' : 'Sonraki adım belirlenmemiş.'}</p>}
    {tracking.deadlineCount > 0 && <p className="text-xs font-medium text-red-700">{tracking.deadlineCount} açık süreli iş · {tracking.openCount} açık iş</p>}
    <p className="text-xs text-muted-foreground">Duruşma: {tracking.nextHearing ? formatDateTime(tracking.nextHearing.date) : 'İleri tarihli kayıt yok'}</p>
    {tracking.lastDevelopment && <p className="line-clamp-2 break-words text-xs text-muted-foreground">Son gelişme ({formatDate(tracking.lastDevelopment.date)}): {tracking.lastDevelopment.text}</p>}
  </div>
}
