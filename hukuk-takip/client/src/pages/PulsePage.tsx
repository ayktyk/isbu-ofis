import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Activity, AlertTriangle, ChevronRight } from 'lucide-react'
import type { CasePulseItem, PulseFlag } from '@hukuk-takip/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency } from '@/lib/utils'
import { usePulse } from '@/hooks/useIntegration'
import PulseFlagChip from '@/components/integration/PulseFlagChip'
import {
  PULSE_FLAG_LABELS,
  PULSE_NEXT_KIND_LABELS,
  PULSE_FLAG_ORDER,
  PULSE_TYPE_LABELS,
  countPulseFlags,
  filterPulse,
  lastActivityLabel,
  pulseHref,
  pulseItemType,
  sortPulse,
  sortPulseFlags,
  type PulseTypeFilter,
} from '@/lib/pulse'
import { formatProposalDate } from '@/lib/proposals'

const TYPE_VALUES: PulseTypeFilter[] = ['all', 'dava', 'arabuluculuk', 'cmk']

function nextItemText(item: CasePulseItem): string | null {
  const next = item.nextItem
  if (!next) return null
  const when = next.date ? formatProposalDate(next.date, next.kind === 'hearing') : 'tarihsiz'
  return `${PULSE_NEXT_KIND_LABELS[next.kind]}: ${next.title} — ${when}`
}

function PulseCard({ item }: { item: CasePulseItem }) {
  const next = nextItemText(item)
  const subtitle = [item.clientName, item.caseNumber, item.courtName].filter(Boolean).join(' · ')
  return (
    <Link to={pulseHref(item)} className="block">
      <Card className="shadow-sm transition hover:bg-muted/30 active:scale-[0.99]">
        <CardContent className="space-y-2 p-3 sm:p-4">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium leading-snug">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {pulseItemType(item) === 'arabuluculuk' ? 'Arabuluculuk' : subtitle || 'Dava'}
              </p>
            </div>
            <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </div>
          {item.flags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sortPulseFlags(item.flags).map((flag) => (
                <PulseFlagChip key={flag} flag={flag} />
              ))}
            </div>
          )}
          {next ? (
            <p className={cn('text-sm', item.nextItem?.overdue ? 'font-medium text-red-700' : 'text-foreground')}>
              {item.nextItem?.overdue ? 'Gecikmiş · ' : ''}
              {next}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Sıradaki iş tanımlı değil.</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{lastActivityLabel(item.daysSinceActivity)}</span>
            {item.openItemCount > 0 && <span>{item.openItemCount} açık iş</span>}
            {item.openBalance !== null && item.openBalance > 0 && <span>Açık bakiye: {formatCurrency(item.openBalance)}</span>}
            {item.overdueInstallments.count > 0 && (
              <span className="text-red-700">
                {item.overdueInstallments.count} gecikmiş taksit ({formatCurrency(item.overdueInstallments.amount)})
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function PulsePage() {
  const [params, setParams] = useSearchParams()
  const flagParam = params.get('bayrak') as PulseFlag | null
  const flag = flagParam && PULSE_FLAG_ORDER.includes(flagParam) ? flagParam : null
  const typeParam = params.get('tur') as PulseTypeFilter | null
  const type: PulseTypeFilter = typeParam && TYPE_VALUES.includes(typeParam) ? typeParam : 'all'

  const { data, isLoading, isError } = usePulse()
  const all = useMemo(() => data ?? [], [data])
  const typed = useMemo(() => filterPulse(all, { type }), [all, type])
  const counts = useMemo(() => countPulseFlags(typed), [typed])
  const visible = useMemo(() => sortPulse(filterPulse(typed, { flag })), [typed, flag])

  function update(key: 'bayrak' | 'tur', value: string | null) {
    const sp = new URLSearchParams(params)
    if (value) sp.set(key, value)
    else sp.delete(key)
    setParams(sp, { replace: true })
  }

  const chip = (active: boolean) =>
    cn(
      'min-h-9 flex-shrink-0 rounded-full border px-3 text-xs font-medium transition',
      active ? 'border-law-primary bg-law-primary text-primary-foreground' : 'bg-card hover:bg-muted'
    )

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="page-title">Dosya Nabzı</h1>
        <p className="mt-1 text-sm text-muted-foreground">Her açık dosyada sırada ne var? En acil olan üstte.</p>
      </div>

      <div className="space-y-2">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Dosya türü">
          {TYPE_VALUES.map((value) => (
            <button key={value} type="button" aria-pressed={type === value} onClick={() => update('tur', value === 'all' ? null : value)} className={chip(type === value)}>
              {PULSE_TYPE_LABELS[value]}
            </button>
          ))}
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Bayrak">
          <button type="button" aria-pressed={!flag} onClick={() => update('bayrak', null)} className={chip(!flag)}>
            Tüm bayraklar ({typed.length})
          </button>
          {PULSE_FLAG_ORDER.map((f) => (
            <button key={f} type="button" aria-pressed={flag === f} onClick={() => update('bayrak', flag === f ? null : f)} className={chip(flag === f)}>
              {PULSE_FLAG_LABELS[f]} ({counts[f] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-64" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">Dosya nabzı yüklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && visible.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Activity className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <h3 className="text-lg font-medium text-muted-foreground">Bu filtrede dosya yok</h3>
        </div>
      )}

      {!isLoading && !isError && visible.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((item) => (
            <PulseCard key={`${item.type}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
