import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAllCollections } from '@/hooks/useCollections'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Wallet,
  AlertTriangle,
  Search,
  Scale,
  Handshake,
  Receipt,
  TrendingUp,
  Inbox,
} from 'lucide-react'

// Kaynak filtresi: tum | sadece dava | sadece arabuluculuk
type SourceFilter = 'all' | 'case' | 'mediation'

const paymentMethodLabels: Record<string, string> = {
  cash: 'Nakit',
  bank_transfer: 'Havale/EFT',
  havale: 'Havale/EFT',
  eft: 'Havale/EFT',
  credit_card: 'Kredi Kartı',
  check: 'Çek',
  pos: 'POS',
  other: 'Diğer',
}

function labelPaymentMethod(method?: string | null) {
  if (!method) return null
  const key = method.toLocaleLowerCase('tr')
  return paymentMethodLabels[key] || method
}

export default function CollectionsPage() {
  const navigate = useNavigate()
  const [source, setSource] = useState<SourceFilter>('all')
  const [query, setQuery] = useState('')

  const { data, isLoading, isError } = useAllCollections(
    source === 'all' ? undefined : { source }
  )

  const collections: any[] = Array.isArray(data) ? data : []

  // Metin filtresi: musvekkil / dava basligi / esas no / dosya no / aciklama / makbuz no
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    if (!q) return collections
    return collections.filter((c) => {
      const hay = [
        c.clientName,
        c.caseTitle,
        c.caseNumber,
        c.mediationFileNo,
        c.mediationDisputeType,
        c.description,
        c.receiptNo,
        c.paymentMethod,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr')
      return hay.includes(q)
    })
  }, [collections, query])

  // Para birimi bazli toplamlar — farkli kurlari dogru TOPLAMIYORUZ, ayri ayri gosteriyoruz.
  const totalsByCurrency = useMemo(() => {
    const totals: Record<string, { sum: number; count: number }> = {}
    for (const c of filtered) {
      const cur = (c.currency || 'TRY').toUpperCase()
      const amt = Number.parseFloat(c.amount || '0')
      if (Number.isNaN(amt)) continue
      if (!totals[cur]) totals[cur] = { sum: 0, count: 0 }
      totals[cur].sum += amt
      totals[cur].count += 1
    }
    return totals
  }, [filtered])

  const currencyKeys = Object.keys(totalsByCurrency).sort()
  const primaryCurrency = currencyKeys.includes('TRY') ? 'TRY' : currencyKeys[0]
  const totalCount = filtered.length

  function openSource(c: any) {
    if (c.caseId) navigate(`/cases/${c.caseId}`)
    else if (c.mediationFileId) navigate(`/tools/mediation-files`)
  }

  return (
    <div className="space-y-6">
      {/* Baslik */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Tahsilatlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tüm dava ve arabuluculuk tahsilatları, toplamları ile birlikte
          </p>
        </div>
      </div>

      {/* Ozet kartlari */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-law-accent/10 text-law-accent">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Kayıt Sayısı</p>
              <p className="mt-0.5 truncate text-lg font-semibold">{totalCount}</p>
            </div>
          </CardContent>
        </Card>

        {currencyKeys.length === 0 ? (
          <Card className="border-0 shadow-sm sm:col-span-2 lg:col-span-3">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Toplam Tahsilat</p>
                <p className="mt-0.5 text-lg font-semibold text-muted-foreground">—</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          currencyKeys.map((cur) => (
            <Card key={cur} className="border-0 shadow-sm">
              <CardContent className="flex items-start gap-3 p-4">
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                    cur === primaryCurrency
                      ? 'bg-law-primary/10 text-law-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {cur === primaryCurrency ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <Wallet className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Toplam ({cur}) · {totalsByCurrency[cur].count} kayıt
                  </p>
                  <p className="mt-0.5 truncate text-lg font-semibold">
                    {formatCurrency(totalsByCurrency[cur].sum, cur)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Filtreler */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl border bg-card p-1 text-sm">
          {(['all', 'case', 'mediation'] as SourceFilter[]).map((key) => {
            const active = source === key
            const label =
              key === 'all' ? 'Tümü' : key === 'case' ? 'Davalar' : 'Arabuluculuk'
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSource(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-law-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Müvekkil, dava, dosya no, açıklama…"
            className="w-full rounded-xl border bg-background py-2 pl-10 pr-3 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
          />
        </div>
      </div>

      {/* Yukleniyor */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 p-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Hata */}
      {isError && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">Tahsilat listesi yüklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {/* Liste */}
      {!isLoading && !isError && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-muted-foreground">
                {collections.length === 0
                  ? 'Henüz tahsilat kaydı yok'
                  : 'Arama kriterine uygun kayıt bulunamadı'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                {collections.length === 0
                  ? 'Tahsilatlar dava veya arabuluculuk dosyası detayından eklenir.'
                  : 'Filtreleri temizleyerek yeniden deneyin.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">Kaynak</th>
                    <th className="hidden px-4 py-3 md:table-cell">Müvekkil</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Açıklama / Makbuz</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Ödeme</th>
                    <th className="px-4 py-3 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((c) => {
                    const isMediation = !!c.mediationFileId
                    const sourceTitle = isMediation
                      ? c.mediationFileNo
                        ? `Arabuluculuk · ${c.mediationFileNo}`
                        : 'Arabuluculuk dosyası'
                      : c.caseTitle || 'Dava'
                    const sourceSub = isMediation
                      ? c.mediationDisputeType || ''
                      : c.caseNumber || ''
                    const SourceIcon = isMediation ? Handshake : Scale
                    const clickable = !!c.caseId || !!c.mediationFileId

                    return (
                      <tr
                        key={c.id}
                        onClick={clickable ? () => openSource(c) : undefined}
                        className={`transition-colors even:bg-muted/20 ${
                          clickable ? 'cursor-pointer hover:bg-muted/50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{formatDate(c.collectionDate)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <SourceIcon
                              className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                                isMediation ? 'text-orange-500' : 'text-law-accent'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{sourceTitle}</p>
                              {sourceSub && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {sourceSub}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span className="text-muted-foreground">
                            {c.clientName || '—'}
                          </span>
                        </td>
                        <td className="hidden max-w-[260px] px-4 py-3 lg:table-cell">
                          {c.description ? (
                            <p className="truncate" title={c.description}>
                              {c.description}
                            </p>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                          {c.receiptNo && (
                            <p className="text-xs text-muted-foreground">
                              Makbuz: {c.receiptNo}
                            </p>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {c.paymentMethod ? (
                            <Badge variant="outline">
                              {labelPaymentMethod(c.paymentMethod)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold tabular-nums">
                            {formatCurrency(c.amount, c.currency || 'TRY')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
