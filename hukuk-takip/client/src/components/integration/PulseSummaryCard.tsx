import { Link } from 'react-router-dom'
import { Activity, Bot, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { usePendingProposalCount, usePulse } from '@/hooks/useIntegration'
import { PULSE_FLAG_CLASSES, PULSE_FLAG_LABELS, PULSE_FLAG_ORDER, countPulseFlags } from '@/lib/pulse'

// Dashboard için kompakt nabız özeti: bayrak başına dosya sayısı + bekleyen öneriler.
export default function PulseSummaryCard() {
  const { data, isLoading, isError } = usePulse()
  const pending = usePendingProposalCount()
  if (isError) return null
  const items = data ?? []
  const counts = countPulseFlags(items)
  const flags = PULSE_FLAG_ORDER.filter((f) => counts[f] > 0)

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold sm:text-base">
            <Activity className="h-4 w-4 text-law-accent" />
            Dosya Nabzı
            {!isLoading && <span className="text-xs font-normal text-muted-foreground">{items.length} açık dosya</span>}
          </h2>
          <Link to="/dosya-nabzi" className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-law-accent hover:underline">
            Tümünü gör <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <div className="h-8 animate-pulse rounded bg-muted" />
        ) : flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Uyarı gerektiren dosya yok.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {flags.map((flag) => (
              <Link
                key={flag}
                to={`/dosya-nabzi?bayrak=${flag}`}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition hover:opacity-80',
                  PULSE_FLAG_CLASSES[flag]
                )}
              >
                {PULSE_FLAG_LABELS[flag]}
                <span className="rounded bg-white/70 px-1.5 py-0.5 text-[11px]">{counts[flag]}</span>
              </Link>
            ))}
          </div>
        )}
        {pending > 0 && (
          <Link
            to="/oneriler"
            className="flex min-h-10 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-medium text-violet-900 transition hover:bg-violet-100"
          >
            <Bot className="h-4 w-4" />
            {pending} asistan önerisi onayınızı bekliyor
            <ChevronRight className="ml-auto h-4 w-4" />
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
