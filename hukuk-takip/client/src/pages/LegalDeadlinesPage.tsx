import { useMemo, useState } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertOctagon,
  AlertTriangle,
  Plus,
  ShieldAlert,
  Hourglass,
  Clock,
} from 'lucide-react'
import {
  daysUntil,
  deadlineCategoryLabels,
  deadlineSeverityLabels,
} from '@/lib/utils'
import { NewLegalDeadlineForm } from '@/components/deadlines/NewLegalDeadlineForm'
import { LegalDeadlineRow, type DeadlineTaskLike } from '@/components/deadlines/LegalDeadlineRow'

const CATEGORIES = ['icra', 'hukuk', 'is', 'ceza', 'idari', 'tbk'] as const
const SEVERITIES = ['hak_dusurucu', 'zamanasimi', 'usul'] as const

const STATUS_OPTIONS = [
  { value: '', label: 'Aktif (Açık + Devam Eden)' },
  { value: 'pending', label: 'Beklemede' },
  { value: 'in_progress', label: 'Devam Ediyor' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'cancelled', label: 'İptal' },
  { value: 'all', label: 'Tümü' },
]

export default function LegalDeadlinesPage() {
  const [category, setCategory] = useState<string>('')
  const [severity, setSeverity] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading, isError } = useTasks({
    isDeadline: true,
    category: category || undefined,
    severity: severity || undefined,
    status: statusFilter && statusFilter !== 'all' ? statusFilter : undefined,
  })

  const tasks: DeadlineTaskLike[] = Array.isArray(data) ? data : data?.data || []

  // Aktif filtre = pending + in_progress
  const visibleTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks
    if (!statusFilter) return tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress')
    return tasks.filter((t) => t.status === statusFilter)
  }, [tasks, statusFilter])

  const sortedTasks = useMemo(() => {
    return [...visibleTasks].sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
      return da - db
    })
  }, [visibleTasks])

  // Sayaçlar — sadece aktifler (pending+in_progress)
  const counters = useMemo(() => {
    const active = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress')
    let critical3 = 0
    let upcoming14 = 0
    let upcoming30 = 0
    let later = 0
    for (const t of active) {
      const d = t.dueDate ? daysUntil(t.dueDate) : null
      if (d === null) continue
      if (d <= 3) critical3++
      else if (d <= 14) upcoming14++
      else if (d <= 30) upcoming30++
      else later++
    }
    return { critical3, upcoming14, upcoming30, later, total: active.length }
  }, [tasks])

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <AlertOctagon className="h-6 w-6 text-red-600" />
            Süreli İşler
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hukuki süreler — itiraz, istinaf, temyiz, zamanaşımı. Bu süreler{' '}
            <strong>kaçırılmamalıdır.</strong>
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Yeni Süreli İş
        </button>
      </div>

      {/* Sayaç bandı */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-red-300 bg-red-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertOctagon className="h-7 w-7 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-700">{counters.critical3}</p>
              <p className="text-xs font-medium text-red-700/80">0-3 gün (KRİTİK)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="flex items-center gap-3 p-4">
            <ShieldAlert className="h-7 w-7 text-orange-600" />
            <div>
              <p className="text-2xl font-bold text-orange-700">{counters.upcoming14}</p>
              <p className="text-xs font-medium text-orange-700/80">4-14 gün</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4">
            <Hourglass className="h-7 w-7 text-amber-600" />
            <div>
              <p className="text-2xl font-bold text-amber-700">{counters.upcoming30}</p>
              <p className="text-xs font-medium text-amber-700/80">15-30 gün</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-7 w-7 text-slate-500" />
            <div>
              <p className="text-2xl font-bold text-slate-700">{counters.later}</p>
              <p className="text-xs font-medium text-muted-foreground">30+ gün</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtreler */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategory('')}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              !category ? 'bg-law-accent text-white' : 'bg-muted text-muted-foreground'
            }`}
          >
            Tüm Kategoriler
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c === category ? '' : c)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                category === c ? 'bg-law-accent text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              {deadlineCategoryLabels[c] || c}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSeverity('')}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              !severity ? 'bg-law-primary text-white' : 'bg-muted text-muted-foreground'
            }`}
          >
            Tüm Şiddetler
          </button>
          {SEVERITIES.map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s === severity ? '' : s)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                severity === s ? 'bg-law-primary text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              {deadlineSeverityLabels[s] || s}
            </button>
          ))}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Liste */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="mt-2 h-3 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">Süreli işler yüklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && sortedTasks.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertOctagon className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-muted-foreground">
              {category || severity || statusFilter
                ? 'Filtrelere uyan süreli iş yok'
                : 'Henüz süreli iş eklenmemiş'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Süreli iş ekleyerek itiraz, istinaf, temyiz ve zamanaşımı sürelerini takip edin.
            </p>
            {!category && !severity && !statusFilter && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Süreli İş Ekle
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && sortedTasks.length > 0 && (
        <div className="space-y-2">
          {sortedTasks.map((t) => (
            <LegalDeadlineRow key={t.id} task={t} />
          ))}
        </div>
      )}

      {showForm && <NewLegalDeadlineForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
