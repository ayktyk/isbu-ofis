import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  Wand2,
  X,
} from 'lucide-react'
import { api } from '@/lib/axios'
import { useCases } from '@/hooks/useCases'
import { caseStatusLabels, formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const statusVariant: Record<string, 'default' | 'success' | 'danger' | 'warning' | 'secondary'> = {
  active: 'default',
  istinafta: 'warning',
  yargıtayda: 'warning',
  won: 'success',
  lost: 'danger',
  settled: 'warning',
  closed: 'secondary',
  passive: 'secondary',
}

const statusGroupOptions = [
  { value: '', label: 'Tüm CMK Dosyaları' },
  { value: 'active', label: 'Aktif' },
  { value: 'finished', label: 'Sonlanan' },
] as const

export default function CmkAssignmentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusGroup, setStatusGroup] = useState('')
  const [page, setPage] = useState(1)
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout>>()
  const pageSize = 20

  const backfillMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await api.post(`/cases/backfill-cmk${dryRun ? '?dryRun=true' : ''}`)
      return res.data as { dryRun: boolean; affected: number; titles: string[] }
    },
    onSuccess: (data) => {
      if (data.dryRun) {
        if (data.affected === 0) {
          toast.info('Başlığı CMK ile başlayan, henüz işaretlenmemiş dava bulunamadı.')
          return
        }
        const list = data.titles.slice(0, 5).join('\n• ')
        const more = data.titles.length > 5 ? `\n• ... ve ${data.titles.length - 5} dava daha` : ''
        const confirmed = window.confirm(
          `${data.affected} dava CMK görevlendirmesi olarak işaretlenecek:\n\n• ${list}${more}\n\nDevam edilsin mi? (Hiçbir veri silinmez, sadece kategori atanır.)`,
        )
        if (confirmed) {
          backfillMutation.mutate(false)
        }
      } else {
        toast.success(`${data.affected} dava CMK görevlendirmelerine taşındı.`)
        queryClient.invalidateQueries({ queryKey: ['cases'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['statistics'] })
      }
    },
    onError: () => toast.error('CMK taşıma başarısız oldu.'),
  })

  function handleSearch(value: string) {
    setSearch(value)
    if (timer) clearTimeout(timer)
    const next = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 300)
    setTimer(next)
  }

  const { data, isLoading } = useCases({
    isCmk: 'only',
    search: debouncedSearch || undefined,
    statusGroup: statusGroup || undefined,
    page,
    pageSize,
  })

  const rows = data?.data || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-law-accent" />
            CMK Görevlendirmeleri
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0
              ? `${total} CMK görevlendirmesi kayıtlı`
              : 'Baro CMK listesinden gelen zorunlu müdafilik dosyaları'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => backfillMutation.mutate(true)}
            disabled={backfillMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
            title="Başlığı 'CMK' ile başlayan ve henüz işaretlenmemiş eski davaları otomatik bul"
          >
            {backfillMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Eski CMK Davalarını Taşı
          </button>
          <button
            type="button"
            onClick={() => navigate('/cases/new?cmk=1')}
            className="inline-flex items-center gap-2 rounded-xl bg-law-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Yeni CMK Görevi
          </button>
        </div>
      </div>

      <Card className="bg-card shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex gap-1.5 overflow-x-auto sm:flex-wrap sm:gap-2">
            {statusGroupOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setStatusGroup(option.value)
                  setPage(1)
                }}
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition sm:px-3.5 sm:py-2 sm:text-sm ${
                  statusGroup === option.value
                    ? 'bg-law-primary text-white shadow-sm'
                    : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Dosya adı, müvekkil, esas no ile ara"
              className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
              <Scale className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Henüz CMK görevlendirmesi yok. Yeni dava eklerken "CMK Görevlendirmesi" işaretini açabilirsin.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-3">Dosya</th>
                    <th className="hidden pb-2 pr-3 sm:table-cell">Müvekkil</th>
                    <th className="hidden pb-2 pr-3 md:table-cell">Esas No</th>
                    <th className="pb-2 pr-3 text-right">Anlaşılan Ücret</th>
                    <th className="pb-2 pr-3">Durum</th>
                    <th className="pb-2 pr-3 text-right">Aç</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row: any) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/cases/${row.id}`)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <td className="py-3 pr-3 font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span className="truncate">{row.title}</span>
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {row.clientName || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="hidden py-3 pr-3 text-muted-foreground sm:table-cell">
                        {row.clientName || '-'}
                      </td>
                      <td className="hidden py-3 pr-3 text-muted-foreground md:table-cell">
                        {row.caseNumber || '-'}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        {row.contractedFee
                          ? formatCurrency(Number(row.contractedFee))
                          : '-'}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant={statusVariant[row.status] || 'secondary'}>
                          {caseStatusLabels[row.status] || row.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <Eye className="ml-auto h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Sayfa {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
