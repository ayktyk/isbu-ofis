import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, Edit, Eye, Plus, Scale, Search, Trash2, X } from 'lucide-react'
import { useCases, useDeleteCase } from '@/hooks/useCases'
import { caseStatusLabels, caseTypeLabels, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const statusVariant: Record<string, 'default' | 'success' | 'danger' | 'warning' | 'secondary'> = {
  active: 'default',
  istinafta: 'warning',
  yargıtayda: 'warning',
  yargitayda: 'warning',
  'yargi\u00adtayda': 'warning',
  won: 'success',
  lost: 'danger',
  settled: 'warning',
  closed: 'secondary',
  passive: 'secondary',
}

const statusGroupOptions = [
  { value: '', label: 'Tüm Davalar' },
  { value: 'active', label: 'Aktif Davalar' },
  { value: 'pending', label: 'Potansiyel Davalar' },
  { value: 'finished', label: 'Biten Davalar' },
] as const

const statusOptions = [
  { value: '', label: 'Tüm Durumlar' },
  { value: 'active', label: 'Aktif' },
  { value: 'istinafta', label: 'Istinafta' },
  { value: 'yargıtayda', label: 'Yargitayda' },
  { value: 'passive', label: 'Pasif' },
  { value: 'won', label: 'Kazanildi' },
  { value: 'lost', label: 'Kaybedildi' },
  { value: 'settled', label: 'Uzlasildi' },
  { value: 'closed', label: 'Kapatildi' },
] as const

const typeOptions = [
  { value: '', label: 'Tüm Türler' },
  { value: 'iscilik_alacagi', label: 'İşçilik Alacağı' },
  { value: 'bosanma', label: 'Boşanma' },
  { value: 'velayet', label: 'Velayet' },
  { value: 'mal_paylasimi', label: 'Mal Paylaşımı' },
  { value: 'kira', label: 'Kira' },
  { value: 'tuketici', label: 'Tüketici' },
  { value: 'icra', label: 'İcra' },
  { value: 'ceza', label: 'Ceza' },
  { value: 'idare', label: 'İdare' },
  { value: 'diger', label: 'Diğer' },
] as const

export default function CasesPage() {
  const navigate = useNavigate()
  const deleteCase = useDeleteCase()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusGroup, setStatusGroup] = useState('')
  const [status, setStatus] = useState('')
  const [caseType, setCaseType] = useState('')
  const [page, setPage] = useState(1)
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout>>()
  const pageSize = 20

  function handleSearch(value: string) {
    setSearch(value)
    if (timer) clearTimeout(timer)

    const nextTimer = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 300)

    setTimer(nextTimer)
  }

  const { data, isLoading, isError } = useCases({
    search: debouncedSearch || undefined,
    statusGroup: statusGroup || undefined,
    status: status || undefined,
    caseType: caseType || undefined,
    page,
    pageSize,
  })

  const cases = data?.data || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / pageSize)
  const hasFilters = Boolean(debouncedSearch || statusGroup || status || caseType)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Davalar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0 ? `${total} dava kayitli` : 'Dava portfoyunuzu buradan yonetin'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/cases/new')}
          className="inline-flex items-center gap-2 rounded-xl bg-law-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Yeni Dava
        </button>
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

          <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(event) => handleSearch(event.target.value)}
                placeholder="Dava adi, muvekkil, mahkeme veya esas no ile ara"
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

            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
              className="rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={caseType}
              onChange={(event) => {
                setCaseType(event.target.value)
                setPage(1)
              }}
              className="rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent"
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-7 w-24 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">Dava listesi yuklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && (
        <>
          {cases.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Scale className="mb-3 h-12 w-12 text-muted-foreground/30" />
                <h3 className="text-lg font-medium">
                  {hasFilters ? 'Sonuc bulunamadi' : 'Henuz dava eklenmemis'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasFilters
                    ? 'Filtreleri degistirerek tekrar deneyin.'
                    : 'Ilk davanizi acarak is takibini buradan baslatin.'}
                </p>
                {!hasFilters && (
                  <button
                    type="button"
                    onClick={() => navigate('/cases/new')}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-law-accent px-4 py-2.5 text-sm font-medium text-white"
                  >
                    <Plus className="h-4 w-4" />
                    Yeni Dava
                  </button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <th className="px-4 py-3">Dava</th>
                        <th className="hidden px-4 py-3 sm:table-cell">Müvekkil</th>
                        <th className="hidden px-4 py-3 md:table-cell">Tur</th>
                        <th className="px-4 py-3">Durum</th>
                        <th className="hidden px-4 py-3 lg:table-cell">Mahkeme</th>
                        <th className="hidden px-4 py-3 lg:table-cell">Tarih</th>
                        <th className="px-4 py-3 text-right">Islem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {cases.map((item: any) => (
                        <tr
                          key={item.id}
                          onClick={() => navigate(`/cases/${item.id}`)}
                          className="cursor-pointer transition hover:bg-muted/50"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium">{item.title}</p>
                            {item.caseNumber && (
                              <p className="text-xs text-muted-foreground">Esas: {item.caseNumber}</p>
                            )}
                          </td>
                          <td className="hidden px-4 py-3 sm:table-cell text-muted-foreground">
                            {item.clientName || '-'}
                          </td>
                          <td className="hidden px-4 py-3 md:table-cell text-muted-foreground">
                            {caseTypeLabels[item.caseType] || item.caseType}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusVariant[item.status] || 'secondary'}>
                              {caseStatusLabels[item.status] || item.status}
                            </Badge>
                          </td>
                          <td className="hidden px-4 py-3 lg:table-cell text-muted-foreground">
                            {item.courtName || '-'}
                          </td>
                          <td className="hidden px-4 py-3 lg:table-cell text-muted-foreground">
                            {formatDate(item.startDate || item.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  navigate(`/cases/${item.id}`)
                                }}
                                className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                title="Goruntule"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  navigate(`/cases/${item.id}/edit`)
                                }}
                                className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                title="Duzenle"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  if (confirm('Bu davayi silmek istediginize emin misiniz?')) {
                                    deleteCase.mutate(item.id)
                                  }
                                }}
                                className="rounded p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                                title="Sil"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} / {total}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                        disabled={page === 1}
                        className="rounded p-1.5 text-muted-foreground transition hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="px-2 text-xs font-medium">
                        {page} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                        disabled={page === totalPages}
                        className="rounded p-1.5 text-muted-foreground transition hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
