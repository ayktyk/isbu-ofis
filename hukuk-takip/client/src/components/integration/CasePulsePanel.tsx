import { Link } from 'react-router-dom'
import { Activity, Bot, ChevronRight } from 'lucide-react'
import { usePendingProposalCount, usePulse } from '@/hooks/useIntegration'
import { PULSE_NEXT_KIND_LABELS, lastActivityLabel, sortPulseFlags } from '@/lib/pulse'
import { formatProposalDate } from '@/lib/proposals'
import PulseFlagChip from './PulseFlagChip'

// Dava detayında küçük nabız satırı + bu davaya ait bekleyen öneri sayısı.
export default function CasePulsePanel({ caseId }: { caseId: string }) {
  const { data } = usePulse()
  const pending = usePendingProposalCount(caseId)
  const item = data?.find((p) => p.type === 'case' && p.id === caseId)
  if (!item && pending === 0) return null
  const next = item?.nextItem

  return (
    <div className="space-y-2 rounded-xl border bg-card p-3 text-sm shadow-sm">
      {item && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-law-accent" /> Dosya nabzı
            </span>
            {sortPulseFlags(item.flags)
              .filter((f) => f !== 'cmk')
              .map((flag) => (
                <PulseFlagChip key={flag} flag={flag} />
              ))}
          </div>
          <p className={next?.overdue ? 'font-medium text-red-700' : ''}>
            {next
              ? `Sırada: ${PULSE_NEXT_KIND_LABELS[next.kind]} — ${next.title} (${next.date ? formatProposalDate(next.date, next.kind === 'hearing') : 'tarihsiz'})`
              : 'Sıradaki iş tanımlı değil.'}
          </p>
          <p className="text-xs text-muted-foreground">{lastActivityLabel(item.daysSinceActivity)}</p>
        </div>
      )}
      {pending > 0 && (
        <Link
          to={`/oneriler?case=${encodeURIComponent(caseId)}`}
          className="flex min-h-10 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 font-medium text-violet-900 transition hover:bg-violet-100"
        >
          <Bot className="h-4 w-4" />
          Bu dava için {pending} bekleyen asistan önerisi
          <ChevronRight className="ml-auto h-4 w-4" />
        </Link>
      )}
    </div>
  )
}
