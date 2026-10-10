import { Link } from 'react-router-dom'
import { AlertTriangle, Check, Loader2, Pencil, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDateTime } from '@/lib/utils'
import {
  buildProposalDiff,
  editFieldsFor,
  proposalKindLabel,
  proposalSourceLabel,
  type ProposalRow,
} from '@/lib/proposals'
import ProposalDiff from './ProposalDiff'

const sourceClass: Record<string, string> = {
  uyap: 'border-blue-200 bg-blue-50 text-blue-800',
  kalkan: 'border-red-200 bg-red-50 text-red-800',
  icra_ozet: 'border-amber-200 bg-amber-50 text-amber-800',
  asistan: 'border-violet-200 bg-violet-50 text-violet-800',
}

const statusLabel: Record<string, string> = {
  pending: 'Bekliyor',
  applied: 'Uygulandı',
  rejected: 'Reddedildi',
  failed: 'Hatalı',
  superseded: 'Gereksiz kaldı',
}

function caseLabel(p: ProposalRow): string | null {
  if (p.caseTitle) return p.caseNumber ? `${p.caseTitle} · ${p.caseNumber}` : p.caseTitle
  const ref = p.caseRef
  if (!ref) return null
  const parts = [ref.case_number, ref.court_name, ref.buro_kodu, ref.external_ref].filter(Boolean)
  return parts.length ? `${parts.join(' · ')} (henüz uygulamada yok)` : null
}

export default function ProposalCard({
  proposal,
  selected,
  onSelect,
  busy,
  onApprove,
  onEdit,
  onReject,
}: {
  proposal: ProposalRow
  selected: boolean
  onSelect?: (checked: boolean) => void
  busy: boolean
  onApprove: () => void
  onEdit: () => void
  onReject: () => void
}) {
  const pending = proposal.status === 'pending'
  const rows = buildProposalDiff(proposal.kind, proposal.payload, proposal.before)
  const label = caseLabel(proposal)
  const editable = editFieldsFor(proposal.kind, proposal.payload).length > 0

  return (
    <Card className={cn('overflow-hidden shadow-sm', proposal.conflict && pending && 'border-amber-300', selected && 'ring-2 ring-law-accent/40')}>
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex items-start gap-3">
          {pending && onSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(e.target.checked)}
              aria-label="Toplu işlem için seç"
              className="mt-1 h-5 w-5 flex-shrink-0 accent-blue-600"
            />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold', sourceClass[proposal.source] ?? 'border-border bg-muted text-foreground')}>
                {proposalSourceLabel(proposal.source)}
              </span>
              <Badge variant="outline" className="text-[11px]">{proposalKindLabel(proposal.kind)}</Badge>
              {!pending && (
                <Badge variant={proposal.status === 'applied' ? 'success' : proposal.status === 'failed' ? 'danger' : 'secondary'} className="text-[11px]">
                  {statusLabel[proposal.status] ?? proposal.status}
                </Badge>
              )}
            </div>
            <p className="break-words font-medium leading-snug">{proposal.summary}</p>
            {label && (
              proposal.caseId ? (
                <Link to={`/cases/${proposal.caseId}`} className="block truncate text-xs font-medium text-law-accent hover:underline">
                  {label}
                </Link>
              ) : (
                <p className="truncate text-xs text-muted-foreground">{label}</p>
              )
            )}
            {proposal.reason && <p className="break-words text-xs text-muted-foreground">Gerekçe: {proposal.reason}</p>}
          </div>
        </div>

        {proposal.conflict && pending && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              <strong>Bu kaydı siz düzenlemiştiniz.</strong> Onaylarsanız aşağıda “Değişecek” görünen alanlar sizin girdiğiniz değerin üzerine yazılır.
            </span>
          </div>
        )}

        <ProposalDiff rows={rows} />

        {proposal.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">Hata: {proposal.error}</p>
        )}
        {proposal.decidedNote && !pending && (
          <p className="text-xs text-muted-foreground">Not: {proposal.decidedNote}</p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Geldi: {formatDateTime(proposal.createdAt)}
          {proposal.decidedAt ? ` · Karar: ${formatDateTime(proposal.decidedAt)}` : ''}
        </p>

        {pending && (
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-law-primary px-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Onayla
            </button>
            <button
              type="button"
              disabled={busy || !editable}
              onClick={onEdit}
              title={editable ? undefined : 'Bu öneri türü düzenlenemez'}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
            >
              <Pencil className="h-4 w-4" />
              <span className="truncate">Düzenle</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Reddet
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
