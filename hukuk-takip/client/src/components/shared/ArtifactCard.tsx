import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, Loader2, XCircle, AlertTriangle, Circle } from 'lucide-react'

export type ArtifactStatus =
  | 'not_started'
  | 'in_progress'
  | 'draft'
  | 'review_required'
  | 'approved'
  | 'rejected'
  | 'completed'

const statusConfig: Record<
  ArtifactStatus,
  {
    label: string
    variant: 'default' | 'success' | 'danger' | 'warning' | 'secondary' | 'outline'
    Icon: LucideIcon
  }
> = {
  not_started: { label: 'Başlanmadı', variant: 'outline', Icon: Circle },
  in_progress: { label: 'Üretiliyor...', variant: 'default', Icon: Loader2 },
  draft: { label: 'Taslak', variant: 'warning', Icon: Clock },
  review_required: { label: 'İnceleme Bekliyor', variant: 'warning', Icon: AlertTriangle },
  approved: { label: 'Onaylandı', variant: 'success', Icon: CheckCircle2 },
  rejected: { label: 'Reddedildi', variant: 'danger', Icon: XCircle },
  completed: { label: 'Tamamlandı', variant: 'success', Icon: CheckCircle2 },
}

interface ArtifactCardProps {
  icon: LucideIcon
  title: string
  description: string
  status: ArtifactStatus
  /** Brief summary text shown below the status */
  summary?: string
  /** Step number in the pipeline (1-based) */
  step?: number
  /** Whether this step is currently actionable */
  active?: boolean
  /** Action buttons rendered at the bottom */
  actions?: React.ReactNode
  children?: React.ReactNode
}

export default function ArtifactCard({
  icon: CardIcon,
  title,
  description,
  status,
  summary,
  step,
  active,
  actions,
  children,
}: ArtifactCardProps) {
  const cfg = statusConfig[status] || statusConfig.not_started
  const StatusIcon = cfg.Icon

  return (
    <Card
      className={`transition-all ${
        active
          ? 'border-law-accent/40 shadow-md ring-1 ring-law-accent/20'
          : status === 'not_started'
            ? 'opacity-60'
            : ''
      }`}
    >
      <CardContent className="space-y-3 p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {step != null && (
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  status === 'approved' || status === 'completed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : active
                      ? 'bg-law-accent text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {step}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CardIcon className="h-4 w-4 shrink-0 text-law-primary" />
                <p className="text-sm font-semibold text-law-primary">{title}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <Badge variant={cfg.variant} className="shrink-0">
            <StatusIcon
              className={`mr-1 h-3 w-3 ${status === 'in_progress' ? 'animate-spin' : ''}`}
            />
            {cfg.label}
          </Badge>
        </div>

        {/* Summary */}
        {summary && (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {summary}
          </div>
        )}

        {/* Extra content */}
        {children}

        {/* Actions */}
        {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
      </CardContent>
    </Card>
  )
}
