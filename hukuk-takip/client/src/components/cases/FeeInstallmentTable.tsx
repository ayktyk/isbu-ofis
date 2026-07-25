import { CheckCircle2, Circle, Trash2 } from 'lucide-react'
import { installmentStatusLabels } from '@hukuk-takip/shared'
import {
  useArchiveFeeInstallment,
  useFeeInstallments,
  useUpdateFeeInstallment,
} from '@/hooks/useFeeInstallments'
import { isInstallmentOverdue } from '@/lib/feeInstallments'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Dava detayindaki taksit plani tablosu.
 *
 * Taksiti olan davalarda gorunur; taksitsiz davalarda hic render edilmez
 * (mevcut ekranlarin gorunumu degismez).
 */
export default function FeeInstallmentTable({ caseId }: { caseId: string }) {
  const { data: installments, isLoading } = useFeeInstallments(caseId)
  const updateInstallment = useUpdateFeeInstallment(caseId)
  const archiveInstallment = useArchiveFeeInstallment(caseId)

  if (isLoading) {
    return <Skeleton className="h-32 rounded-xl" />
  }

  // Taksit yoksa bolum hic gosterilmez.
  if (!installments || installments.length === 0) return null

  const total = installments.reduce((sum, row) => sum + Number.parseFloat(row.amount || '0'), 0)
  const paid = installments
    .filter((row) => row.status === 'paid')
    .reduce((sum, row) => sum + Number.parseFloat(row.amount || '0'), 0)
  const remaining = total - paid

  function togglePaid(row: { id: string; status: string }) {
    updateInstallment.mutate({
      id: row.id,
      status: row.status === 'paid' ? 'pending' : 'paid',
    })
  }

  function handleArchive(id: string) {
    const confirmed = window.confirm(
      'Bu taksit satırı kaldırılacak. Tahsilat kayıtları etkilenmez. Devam edilsin mi?'
    )
    if (confirmed) archiveInstallment.mutate(id)
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Ödeme Planı</h3>
          <p className="text-xs text-muted-foreground">
            Toplam <strong>{formatCurrency(total, 'TRY')}</strong> · Ödenen{' '}
            <strong className="text-emerald-600">{formatCurrency(paid, 'TRY')}</strong> · Kalan{' '}
            <strong className="text-amber-700 dark:text-amber-400">
              {formatCurrency(remaining, 'TRY')}
            </strong>
          </p>
        </div>

        <div className="divide-y rounded-xl border">
          {installments.map((row) => {
            const isPaid = row.status === 'paid'
            const overdue = isInstallmentOverdue(row)

            return (
              <div
                key={row.id}
                className={`flex items-center gap-3 px-3 py-2.5 ${
                  isPaid ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => togglePaid(row)}
                  className={`flex-shrink-0 transition-colors ${
                    isPaid
                      ? 'text-emerald-600 hover:text-emerald-700'
                      : 'text-muted-foreground/40 hover:text-law-accent'
                  }`}
                  aria-label={isPaid ? 'Ödenmedi olarak işaretle' : 'Ödendi olarak işaretle'}
                >
                  {isPaid ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>

                <span className="w-6 flex-shrink-0 text-xs text-muted-foreground">{row.seq}.</span>

                <span className="flex-1 font-medium tabular-nums">
                  {formatCurrency(row.amount, 'TRY')}
                </span>

                <span
                  className={`text-xs tabular-nums ${
                    overdue ? 'font-semibold text-red-600' : 'text-muted-foreground'
                  }`}
                >
                  {formatDate(row.dueDate)}
                  {overdue && ' · vadesi geçti'}
                </span>

                <span
                  className={`hidden rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline ${
                    isPaid
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : overdue
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {installmentStatusLabels[row.status] || row.status}
                </span>

                <button
                  type="button"
                  onClick={() => handleArchive(row.id)}
                  className="flex-shrink-0 rounded-lg p-2 text-muted-foreground/60 transition hover:bg-red-50 hover:text-red-600"
                  aria-label="Taksiti kaldır"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
