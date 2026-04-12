import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, Clock, Circle, AlertTriangle } from 'lucide-react'

export interface TimelineEvent {
  id: string | number
  title: string
  date: string
  description?: string
  icon?: LucideIcon
  status: 'completed' | 'in-progress' | 'pending' | 'warning'
  /** Optional link/action */
  onClick?: () => void
}

interface CaseTimelineProps {
  events: TimelineEvent[]
  className?: string
}

const statusStyles = {
  completed: {
    dot: 'bg-emerald-500 ring-emerald-100',
    line: 'bg-emerald-300',
    icon: CheckCircle2,
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
  },
  'in-progress': {
    dot: 'bg-law-accent ring-blue-100 animate-pulse',
    line: 'bg-border',
    icon: Clock,
    text: 'text-law-accent',
    bg: 'bg-law-accent/5',
  },
  pending: {
    dot: 'bg-muted-foreground/30 ring-muted',
    line: 'bg-border',
    icon: Circle,
    text: 'text-muted-foreground',
    bg: 'bg-transparent',
  },
  warning: {
    dot: 'bg-amber-500 ring-amber-100',
    line: 'bg-amber-200',
    icon: AlertTriangle,
    text: 'text-amber-700',
    bg: 'bg-amber-50',
  },
}

export default function CaseTimeline({ events, className }: CaseTimelineProps) {
  return (
    <div className={cn('relative', className)}>
      {events.map((event, idx) => {
        const isLast = idx === events.length - 1
        const style = statusStyles[event.status]
        const EventIcon = event.icon || style.icon

        return (
          <div
            key={event.id}
            className={cn(
              'group relative flex gap-4 pb-8',
              isLast && 'pb-0',
              event.onClick && 'cursor-pointer'
            )}
            onClick={event.onClick}
          >
            {/* Vertical line + dot */}
            <div className="relative flex flex-col items-center">
              {/* Dot */}
              <div
                className={cn(
                  'relative z-10 flex h-9 w-9 items-center justify-center rounded-full ring-4 transition-transform group-hover:scale-110',
                  style.dot
                )}
              >
                <EventIcon className="h-4 w-4 text-white" />
              </div>
              {/* Line */}
              {!isLast && (
                <div className={cn('w-0.5 flex-1 mt-1', style.line)} />
              )}
            </div>

            {/* Content */}
            <div
              className={cn(
                'flex-1 rounded-lg border px-4 py-3 transition-all group-hover:shadow-sm',
                style.bg,
                event.status === 'in-progress' && 'border-law-accent/30',
                event.status === 'warning' && 'border-amber-200'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className={cn('text-sm font-semibold', style.text)}>
                  {event.title}
                </h4>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {event.date}
                </time>
              </div>
              {event.description && (
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {event.description}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
