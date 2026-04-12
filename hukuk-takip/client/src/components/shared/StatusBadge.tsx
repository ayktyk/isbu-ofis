import { Badge } from '@/components/ui/badge'
import {
  caseStatusLabels,
  taskStatusLabels,
  taskPriorityLabels,
  hearingResultLabels,
} from '@/lib/utils'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'danger'

const variantMaps: Record<string, Record<string, BadgeVariant>> = {
  caseStatus: {
    active: 'default',
    won: 'success',
    lost: 'danger',
    settled: 'warning',
    closed: 'secondary',
    passive: 'secondary',
  },
  taskStatus: {
    pending: 'warning',
    in_progress: 'default',
    completed: 'success',
    cancelled: 'secondary',
  },
  taskPriority: {
    urgent: 'danger',
    high: 'warning',
    medium: 'secondary',
    low: 'outline',
  },
  hearingResult: {
    pending: 'warning',
    completed: 'success',
    postponed: 'secondary',
    cancelled: 'danger',
  },
}

const labelMaps: Record<string, Record<string, string>> = {
  caseStatus: caseStatusLabels,
  taskStatus: taskStatusLabels,
  taskPriority: taskPriorityLabels,
  hearingResult: hearingResultLabels,
}

interface StatusBadgeProps {
  type: 'caseStatus' | 'taskStatus' | 'taskPriority' | 'hearingResult'
  value: string
}

export function StatusBadge({ type, value }: StatusBadgeProps) {
  const variant = variantMaps[type]?.[value] ?? 'secondary'
  const label = labelMaps[type]?.[value] ?? value

  return <Badge variant={variant}>{label}</Badge>
}
