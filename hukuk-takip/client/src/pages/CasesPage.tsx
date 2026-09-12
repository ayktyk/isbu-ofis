import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCaseListFilters, useCaseListPosition } from '@/hooks/useCaseListPosition'
import { AlertTriangle, ChevronLeft, ChevronRight, Edit, Eye, PhoneCall, Plus, Scale, Search, Trash2, X } from 'lucide-react'
import { useCases, useDeleteCase } from '@/hooks/useCases'
import { useConsultations } from '@/hooks/useConsultations'
import { caseStatusLabels, caseTypeLabels, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import CaseTrackingPreview from '@/components/cases/CaseTrackingPreview'

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
  const location = useLocation()
  const { params, setFilter } = useCaseListFilters()
  const listState = { caseListUrl: location.pathname + location.search }
  const [showFilters, setShowFilters] = useState(false)

  const search = params.get('search') || ''
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const statusGroup = params.get('statusGroup') || ''
  const status = params.get('status') || ''
  const caseType = params.get('caseType') || ''
  const includeCmk = params.get('cmk') !== 'exclude'
  const rawPage = Number(params.get('page') || 1)
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const setStatusGroup = (value: string) => setFilter('statusGroup', value)
  const setStatus = (value: string) => setFilter('status', value)
  const setCaseType = (value: string) => setFilter('caseType', value)
  const setPage = (value: number | ((current: number) => number)) => setFilter('page', String(typeof value === 'function' ? value(page) : value))
  const pageSize = 20

  function handleSearch(value: string) {
    setFilter('search', value)
  }
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading, isError } = useCases({
    search: debouncedSearch || undefined,
    statusGroup: statusGroup || undefined,
    status: status || undefined,
    caseType: caseType || undefined,
    page,
    pageSize,
    isCmk: includeCmk ? 'include' : undefined,
    includeTracking: true,
    trackingFilter: params.get('tracking') || undefined,
  })

  // "Potansiyel Davalar" sekmesinde, henüz dosya açılmamış potansiyel
  // görüşmeler de listenin üstüne eklenir. Diğer sekmelerde sorgu fetch
  // edilmez (enabled false ile çağrılma maliyeti yok).
  const showPotentialConsultations = statusGroup === 'pending' && !debouncedSearch && !status && !caseType && !params.get('tracking')
  const { data: potentialConsultations } = useConsultations(
    showPotentialConsultations ? { status: 'potential' } : undefined
  )
  const allConsultationRows = showPotentialConsultations && Array.isArray(potentialConsultations)
    ? potentialConsultations
    : []
  // Pagination cases üzerinden ilerlerken görüşmeler her sayfada tekrar
  // edilmesin — yalnızca ilk sayfada üstte göster.
  const consultationRows = page === 1 ? allConsultationRows : []

  const cases = data?.data || []
  const total = (data?.total || 0) + allConsultationRows.length
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / pageSize))
  const hasFilters = Boolean(debouncedSearch || statusGroup || status || caseType)
  const hasAnyRow = cases.length > 0 || consultationRows.length > 0
  useCaseListPosition(!isLoading && !isError && debouncedSearch === search)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Davalar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0 ? `${total} kayıt · ${includeCmk ? 'CMK dahil' : 'CMK hariç'}` : 'Dava portföyünüzü buradan yönetin'}
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
          <label className="block text-sm font-medium">Dosya takibi
            <select aria-label="Dosya takibi" value={params.get('tracking') || ''} onChange={event => setFilter('tracking', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3">
              <option value="">Tüm dosyalar</option><option value="overdue">Geciken işler / kontroller</option><option value="waiting">Yanıt veya belge beklenenler</option><option value="unplanned">Sonraki adımı belirlenmemiş</option><option value="check">Bugün kontrol edilecekler</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={includeCmk} onChange={event => setFilter('cmk', event.target.checked ? '' : 'exclude')} className="h-4 w-4" />
            CMK görevlendirmelerini de göster
          </label>
          <div className="flex gap-1.5 overflow-x-auto sm:flex-wrap sm:gap-2">
            {statusGroupOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setStatusGroup(option.value)
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

            <button type="button" className="min-h-11 rounded-xl border px-3 text-sm sm:hidden" aria-expanded={showFilters} onClick={() => setShowFilters(value => !value)}>
              Filtreler{status || caseType ? ' · Etkin' : ''}
            </button>
            <select
              aria-label="Dava durumu"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
              }}
              className={`${showFilters ? 'block' : 'hidden sm:block'} rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent`}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Dava türü"
              value={caseType}
              onChange={(event) => {
                setCaseType(event.target.value)
              }}
              className={`${showFilters ? 'block' : 'hidden sm:block'} rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-law-accent`}
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
          {cases.length > 0 && data?.trackingVersion !== 1 && <p className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">Takip özeti alınamadı. Dava bilgilerini görüntüleyebilir, işleri dosya içinden kontrol edebilirsiniz.</p>}
          {!hasAnyRow ? (
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
                <div className="space-y-3 bg-background md:hidden">
                  {consultationRows.map((item: any) => (
                    <Link key={item.id} to="/consultations" className="block rounded-xl border border-amber-200 bg-card p-4">
                      <Badge variant="warning">Potansiyel görüşme</Badge>
                      <p className="mt-2 font-semibold">{item.fullName}</p>
                      <p className="text-sm text-muted-foreground">{item.subject}</p>
                    </Link>
                  ))}
                  {cases.map((item: any) => (
                    <article key={item.id} className="block rounded-xl border bg-card p-4 shadow-sm transition active:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-law-accent">
                      <Link to={`/cases/${item.id}`} state={listState} className="block">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 break-words font-semibold">{item.clientName || 'Müvekkil belirtilmemiş'}</p>
                        <Badge variant={statusVariant[item.status] || 'secondary'}>{caseStatusLabels[item.status] || item.status}</Badge>
                      </div>
                      <p className="mt-2 break-words text-sm font-medium">{item.title}</p>
                      {item.workflow && <p className="mt-2 text-sm">Aşama: {item.workflow.stage || 'Belirtilmedi'}{item.workflow.waitingFor && ` · Beklenen: ${item.workflow.waitingFor}`}{item.workflow.checkDate && ` · Kontrol: ${formatDate(item.workflow.checkDate)}`}</p>}
                      <p className="mt-1 break-words text-sm text-muted-foreground">{item.courtName || 'Mahkeme belirtilmemiş'}</p>
                      {item.isCmkAssignment && <p className="mt-1 text-xs text-muted-foreground">CMK görevlendirmesi</p>}
                      </Link>
                      {data?.trackingVersion === 1 && item.tracking && <div className="mt-3 rounded-lg bg-muted/30 p-3"><CaseTrackingPreview listState={listState} caseId={item.id} tracking={item.tracking} status={item.status} /></div>}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                        <span>Esas: {item.caseNumber || 'Belirtilmemiş'}</span>
                        <Link to={`/cases/${item.id}`} state={listState} className="font-medium text-law-accent">Dosyayı aç →</Link>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="table-mobile-scroll hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <th className="w-12 px-3 py-3 text-center">#</th>
                        <th className="px-4 py-3">Dava</th>
                        <th className="hidden px-4 py-3 sm:table-cell">Müvekkil</th>
                        <th className="hidden px-4 py-3 md:table-cell">Tur</th>
                        <th className="px-4 py-3">Durum</th>
                        {data?.trackingVersion === 1 && <th className="min-w-64 px-4 py-3">Dosya takibi</th>}
                        <th className="hidden px-4 py-3 lg:table-cell">Mahkeme</th>
                        <th className="hidden px-4 py-3 lg:table-cell">Tarih</th>
                        <th className="px-4 py-3 text-right">Islem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {/* Potansiyel görüşmeler — sadece "Potansiyel Davalar" sekmesinde
                          ve filtre yokken üstte gösterilir. Tıklanınca Görüşmeler
                          sayfasına yönlendirir; cases gibi düzenle/sil eylemi yok.
                          Sıra numarası, görüşmeler ile dava sayımı için ortak bir
                          sayaç kullanılır. */}
                      {consultationRows.map((cons: any, consIdx: number) => (
                        <tr
                          key={`cons-${cons.id}`}
                          onClick={() => navigate('/consultations')}
                          className="cursor-pointer bg-amber-50/40 transition hover:bg-amber-100/60"
                        >
                          <td className="w-12 px-3 py-3 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                            {consIdx + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <PhoneCall className="h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                              <p className="font-medium">{cons.fullName}</p>
                            </div>
                            {cons.subject && (
                              <p className="ml-5 text-xs text-muted-foreground truncate">{cons.subject}</p>
                            )}
                          </td>
                          <td className="hidden px-4 py-3 sm:table-cell text-muted-foreground">
                            {cons.phone || '-'}
                          </td>
                          <td className="hidden px-4 py-3 md:table-cell text-muted-foreground">
                            Görüşme
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="warning">GÖRÜŞME</Badge>
                          </td>
                          {data?.trackingVersion === 1 && <td className="px-4 py-3 text-muted-foreground">Henüz dava açılmadı.</td>}
                          <td className="hidden px-4 py-3 lg:table-cell text-muted-foreground">
                            -
                          </td>
                          <td className="hidden px-4 py-3 lg:table-cell text-muted-foreground">
                            {cons.consultationDate ? formatDate(cons.consultationDate) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  navigate('/consultations')
                                }}
                                className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                title="Görüşmeyi Aç"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {cases.map((item: any, idx: number) => (
                        <tr
                          key={item.id}
                          onClick={() => navigate(`/cases/${item.id}`, { state: listState })}
                          className="cursor-pointer transition hover:bg-muted/50"
                        >
                          <td className="w-12 px-3 py-3 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                            {consultationRows.length + (page - 1) * pageSize + idx + 1}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{item.title}</p>
                            {item.workflow && <p className="mt-1 text-xs text-muted-foreground">{item.workflow.stage || 'Aşama belirtilmedi'}{item.workflow.waitingFor && ` · ${item.workflow.waitingFor}`}{item.workflow.checkDate && ` · Kontrol: ${formatDate(item.workflow.checkDate)}`}</p>}
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
                          {data?.trackingVersion === 1 && <td className="max-w-sm px-4 py-3">{item.tracking ? <CaseTrackingPreview listState={listState} caseId={item.id} tracking={item.tracking} status={item.status} /> : 'Takip özeti alınamadı.'}</td>}
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
                                  navigate(`/cases/${item.id}`, { state: listState })
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
