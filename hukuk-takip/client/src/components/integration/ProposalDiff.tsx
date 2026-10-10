import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProposalDiffRow } from '@/lib/proposals'

const effectNote: Record<ProposalDiffRow['effect'], string | null> = {
  new: 'Yeni',
  change: 'Değişecek',
  same: 'Aynı',
  kept: 'Mevcut değer korunur',
}

const effectClass: Record<ProposalDiffRow['effect'], string> = {
  new: 'text-emerald-700',
  change: 'text-amber-700',
  same: 'text-muted-foreground',
  kept: 'text-muted-foreground',
}

// Önce → sonra satırları. Mobilde alt alta, geniş ekranda tek satır.
export default function ProposalDiff({ rows }: { rows: ProposalDiffRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">Gösterilecek alan yok.</p>
  }
  return (
    <dl className="divide-y rounded-lg border bg-muted/20 text-sm">
      {rows.map((row) => (
        <div key={row.key} className="grid gap-1 px-3 py-2 sm:grid-cols-[9rem_1fr] sm:gap-3">
          <dt className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground sm:block">
            <span>{row.label}</span>
            <span className={cn('text-[10px] font-semibold uppercase tracking-wide sm:mt-0.5 sm:block', effectClass[row.effect])}>
              {effectNote[row.effect]}
            </span>
          </dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 break-words">
            {row.effect !== 'new' && (
              <>
                <span className={cn('min-w-0', row.effect === 'change' && 'text-muted-foreground line-through decoration-red-400/70')}>
                  {row.before ?? '—'}
                </span>
                {row.effect === 'change' && <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
              </>
            )}
            {(row.effect === 'new' || row.effect === 'change') && (
              <span className="min-w-0 font-medium text-foreground">{row.after ?? '—'}</span>
            )}
            {row.effect === 'kept' && (
              <span className="min-w-0 text-xs text-muted-foreground">(öneri: {row.after ?? '—'})</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
