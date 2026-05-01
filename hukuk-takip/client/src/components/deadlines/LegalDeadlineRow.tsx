import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, CheckCircle2, ExternalLink, RotateCcw, AlertOctagon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useUpdateTaskStatus } from '@/hooks/useTasks'
import {
  daysUntil,
  deadlineCategoryLabels,
  deadlineDaysClass,
  deadlineDaysLabel,
  deadlineSeverityLabels,
  formatDate,
} from '@/lib/utils'
import { CompleteDeadlineModal } from './CompleteDeadlineModal'

export interface DeadlineTaskLike {
  id: string
  title: string
  description?: string | null
  status: string
  dueDate?: string | null
  caseId?: string | null
  caseTitle?: string | null
  deadlineCategory?: string | null
  deadlineSeverity?: string | null
  legalBasis?: string | null
  triggerEventDate?: string | null
  triggerEventLabel?: string | null
  adjustedForHoliday?: boolean
  completionEvidence?: string | null
}

export function LegalDeadlineRow({ task }: { task: DeadlineTaskLike }) {
  const navigate = useNavigate()
  const [showComplete, setShowComplete] = useState(false)
  const updateStatus = useUpdateTaskStatus()

  const completed = task.status === 'completed'
  const cancelled = task.status === 'cancelled'
  const daysLeft = task.dueDate ? daysUntil(task.dueDate) : null
  const isCritical = !completed && !cancelled && daysLeft !== null && daysLeft <= 3
  const isUpcoming = !completed && !cancelled && daysLeft !== null && daysLeft > 3 && daysLeft <= 14

  const borderClass = completed
    ? 'border-emerald-200 opacity-70'
    : cancelled
      ? 'border-slate-200 opacity-70'
      : isCritical
        ? 'border-red-500 border-l-4 bg-red-50/40'
        : isUpcoming
          ? 'border-orange-300 border-l-4'
          : 'border-l-4 border-l-slate-200'

  return (
    <>
      <Card className={`transition-colors ${borderClass}`}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {isCritical && <AlertOctagon className="h-4 w-4 text-red-600" />}
                <p className={`font-medium text-law-primary ${completed || cancelled ? 'line-through' : ''}`}>
                  {task.title}
                </p>
                {task.deadlineSeverity && (
                  <Badge
                    variant={task.deadlineSeverity === 'hak_dusurucu' ? 'danger' : 'warning'}
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {deadlineSeverityLabels[task.deadlineSeverity] || task.deadlineSeverity}
                  </Badge>
                )}
                {task.deadlineCategory && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {deadlineCategoryLabels[task.deadlineCategory] || task.deadlineCategory}
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {task.legalBasis && <span className="font-medium text-slate-600">{task.legalBasis}</span>}
                {task.triggerEventDate && (
                  <span>
                    {task.triggerEventLabel || 'Tetik tarihi'}: {formatDate(task.triggerEventDate)}
                  </span>
                )}
                {task.dueDate && (
                  <span className={isCritical ? 'font-semibold text-red-600' : ''}>
                    Son gün: {formatDate(task.dueDate)}
                    {task.adjustedForHoliday ? ' (tatil ötelemeli)' : ''}
                  </span>
                )}
                {task.caseTitle && task.caseId && (
                  <button
                    onClick={() => navigate(`/cases/${task.caseId}`)}
                    className="inline-flex items-center gap-1 hover:text-law-accent hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {task.caseTitle}
                  </button>
                )}
              </div>

              {(completed || cancelled) && task.completionEvidence && (
                <p
                  className={`mt-2 rounded p-2 text-xs ${
                    completed ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {completed ? 'Tamamlandı:' : 'Not:'} {task.completionEvidence}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                  completed
                    ? 'bg-emerald-100 text-emerald-700'
                    : cancelled
                      ? 'bg-slate-200 text-slate-700'
                      : deadlineDaysClass(daysLeft)
                }`}
              >
                {completed ? 'Tamamlandı' : cancelled ? 'İptal edildi' : deadlineDaysLabel(daysLeft)}
              </span>

              <div className="flex gap-1">
                {!completed && !cancelled && (
                  <button
                    type="button"
                    onClick={() => setShowComplete(true)}
                    className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Yapıldı
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (cancelled) {
                      updateStatus.mutate({ id: task.id, status: 'pending' })
                      return
                    }

                    if (confirm('Bu kayıt silinmeyecek. Süreli iş iptal durumuna alınacak. Devam edilsin mi?')) {
                      updateStatus.mutate({
                        id: task.id,
                        status: 'cancelled',
                        completionEvidence:
                          task.completionEvidence || 'Süreli iş iptal edildi; kayıt arşivde tutuluyor.',
                      })
                    }
                  }}
                  className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-slate-100 hover:text-slate-800"
                  aria-label={cancelled ? 'Yeniden aç' : 'İptal et'}
                >
                  {cancelled ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Yeniden Aç
                    </>
                  ) : (
                    <>
                      <Ban className="h-3.5 w-3.5" />
                      İptal Et
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {showComplete && (
        <CompleteDeadlineModal
          task={{ id: task.id, title: task.title, legalBasis: task.legalBasis }}
          onClose={() => setShowComplete(false)}
        />
      )}
    </>
  )
}
