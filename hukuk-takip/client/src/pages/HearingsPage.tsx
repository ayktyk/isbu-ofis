import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHearings, useCreateHearing } from '@/hooks/useHearings'
import { useCases } from '@/hooks/useCases'
import {
  formatDateTime,
  formatRelativeDate,
  isOverdue,
  hearingResultLabels,
  localInputToISO,
} from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { CalendarClock, AlertTriangle, Plus, Loader2, Search } from 'lucide-react'

const resultVariant: Record<string, 'success' | 'warning' | 'danger' | 'secondary'> = {
  completed: 'success',
  postponed: 'warning',
  cancelled: 'danger',
  pending: 'secondary',
}

export default function HearingsPage() {
  const navigate = useNavigate()
  const { data: hearings, isLoading, isError } = useHearings({ upcoming: true })
  const createHearing = useCreateHearing()

  // Modal state
  const [open, setOpen] = useState(false)
  const [caseId, setCaseId] = useState('')
  const [caseSearch, setCaseSearch] = useState('')
  const [hearingDate, setHearingDate] = useState('')
  const [courtRoom, setCourtRoom] = useState('')
  const [judge, setJudge] = useState('')
  const [notes, setNotes] = useState('')

  // Modal için dava listesi (aktif davalar)
  const { data: casesResponse, isLoading: casesLoading } = useCases({
    statusGroup: 'active',
    pageSize: 200,
  })
  const allCases: any[] = useMemo(() => {
    const raw = Array.isArray(casesResponse) ? casesResponse : casesResponse?.data || []
    return raw
  }, [casesResponse])
  const filteredCases = useMemo(() => {
    const q = caseSearch.trim().toLocaleLowerCase('tr')
    if (!q) return allCases
    return allCases.filter((c: any) => {
      const hay = `${c.title || ''} ${c.caseNumber || ''} ${c.clientName || ''}`.toLocaleLowerCase('tr')
      return hay.includes(q)
    })
  }, [allCases, caseSearch])

  const list = Array.isArray(hearings) ? hearings : hearings?.data || []

  function resetForm() {
    setCaseId('')
    setCaseSearch('')
    setHearingDate('')
    setCourtRoom('')
    setJudge('')
    setNotes('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!caseId || !hearingDate) return
    createHearing.mutate(
      {
        caseId,
        hearingDate: localInputToISO(hearingDate),
        courtRoom: courtRoom || undefined,
        judge: judge || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false)
          resetForm()
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Duruşmalar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tüm yaklaşan ve geçmiş duruşmalar
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-law-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Yeni Duruşma
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">Duruşma listesi yüklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && (
        <>
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarClock className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-muted-foreground">Duruşma bulunmuyor</h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Yukarıdaki "Yeni Duruşma" butonu ile ekleyebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">Dava / Müvekkil</th>
                    <th className="hidden px-4 py-3 md:table-cell">Mahkeme</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Salon</th>
                    <th className="px-4 py-3">Sonuç</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((h: any) => {
                    const overdue = isOverdue(h.hearingDate) && (!h.result || h.result === 'pending')
                    return (
                      <tr
                        key={h.id}
                        onClick={() => h.caseId && navigate(`/cases/${h.caseId}`)}
                        className="cursor-pointer transition-colors hover:bg-muted/50 even:bg-muted/20"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {overdue && <span className="h-2 w-2 rounded-full bg-destructive" />}
                            <div>
                              <p className={`font-medium ${overdue ? 'text-destructive' : ''}`}>
                                {formatDateTime(h.hearingDate)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatRelativeDate(h.hearingDate)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{h.caseTitle || '—'}</p>
                          <p className="text-xs text-muted-foreground">{h.clientName || ''}</p>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span className="text-muted-foreground">{h.courtName || '—'}</span>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {h.courtRoom ? (
                            <Badge variant="outline">{h.courtRoom}</Badge>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={resultVariant[h.result] || 'secondary'}>
                            {hearingResultLabels[h.result] || h.result || 'Beklemede'}
                          </Badge>
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

      {/* Yeni Duruşma modalı */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Duruşma Ekle</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Dava *</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={caseSearch}
                  onChange={(e) => setCaseSearch(e.target.value)}
                  placeholder="Dava / müvekkil / esas no ile filtrele…"
                  className="w-full rounded-xl border bg-background py-2 pl-10 pr-3 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                />
              </div>
              <div className="max-h-40 overflow-auto rounded-xl border bg-background">
                {casesLoading ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">Davalar yükleniyor…</div>
                ) : filteredCases.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">Dava bulunamadı.</div>
                ) : (
                  filteredCases.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCaseId(c.id)}
                      className={`flex w-full items-start justify-between gap-2 border-b px-3 py-2 text-left text-sm transition last:border-b-0 ${
                        caseId === c.id ? 'bg-law-accent/15' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.title || 'Başlıksız dava'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[c.caseNumber, c.clientName].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      {caseId === c.id && <Badge variant="secondary">Seçili</Badge>}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Tarih &amp; Saat *</label>
                <input
                  type="datetime-local"
                  value={hearingDate}
                  onChange={(e) => setHearingDate(e.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Salon</label>
                <input
                  type="text"
                  value={courtRoom}
                  onChange={(e) => setCourtRoom(e.target.value)}
                  placeholder="Örn. 3. Salon"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Hakim</label>
                <input
                  type="text"
                  value={judge}
                  onChange={(e) => setJudge(e.target.value)}
                  placeholder="Hakim adı"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Not</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Duruşma için kısa not…"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                />
              </div>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => { setOpen(false); resetForm() }}
                className="rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={createHearing.isPending || !caseId || !hearingDate}
                className="inline-flex items-center gap-2 rounded-xl bg-law-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {createHearing.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Kaydet
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
