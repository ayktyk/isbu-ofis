import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createConsultationSchema,
  updateConsultationSchema,
  consultationTypeValues,
  consultationStatusValues,
  consultationSourceValues,
  consultationTypeLabels,
  consultationStatusLabels,
  consultationSourceLabels,
  type CreateConsultationInput,
  type UpdateConsultationInput,
} from '@hukuk-takip/shared'
import {
  useConsultations,
  useConsultationStats,
  useCreateConsultation,
  useUpdateConsultation,
  useDeleteConsultation,
  useConvertConsultation,
} from '@/hooks/useConsultations'
import { useClients } from '@/hooks/useClients'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PhoneCall,
  Phone,
  Users,
  Plus,
  X,
  Loader2,
  Save,
  Pencil,
  Trash2,
  AlertTriangle,
  UserPlus,
  Target,
  TrendingUp,
  Calendar as CalendarIcon,
} from 'lucide-react'

function formatDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusVariant: Record<string, 'success' | 'warning' | 'secondary' | 'default'> = {
  converted: 'success',
  pending: 'warning',
  potential: 'default',
  declined: 'secondary',
}

// ─── Edit Form ──────────────────────────────────────────────────────────────

function EditConsultationForm({
  consultation,
  clientsList,
  onClose,
}: {
  consultation: any
  clientsList: any[]
  onClose: () => void
}) {
  const update = useUpdateConsultation(consultation.id)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UpdateConsultationInput>({
    resolver: zodResolver(updateConsultationSchema),
    defaultValues: {
      consultationDate: consultation.consultationDate
        ? new Date(consultation.consultationDate).toISOString().slice(0, 16)
        : '',
      fullName: consultation.fullName || '',
      phone: consultation.phone || '',
      type: consultation.type || 'phone',
      subject: consultation.subject || '',
      notes: consultation.notes || '',
      status: consultation.status || 'pending',
      source: consultation.source || '',
      sourceDetail: consultation.sourceDetail || '',
      referredByClientId: consultation.referredByClientId || '',
      nextActionDate: consultation.nextActionDate
        ? new Date(consultation.nextActionDate).toISOString().split('T')[0]
        : '',
    },
  })

  const source = watch('source')

  function onSubmit(data: UpdateConsultationInput) {
    update.mutate(data, { onSuccess: onClose })
  }

  return (
    <Card className="border-law-accent/30 bg-law-accent/5">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Ad Soyad</label>
              <input
                {...register('fullName')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
              />
              {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Telefon</label>
              <input
                {...register('phone')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Tarih & Saat</label>
              <input
                {...register('consultationDate')}
                type="datetime-local"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Görüşme Tipi</label>
              <select
                {...register('type')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
              >
                {consultationTypeValues.map((t) => (
                  <option key={t} value={t}>{consultationTypeLabels[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Durum</label>
              <select
                {...register('status')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
              >
                {consultationStatusValues.map((s) => (
                  <option key={s} value={s}>{consultationStatusLabels[s]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Referans Kaynağı</label>
              <select
                {...register('source')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
              >
                <option value="">Seçilmedi</option>
                {consultationSourceValues.map((s) => (
                  <option key={s} value={s}>{consultationSourceLabels[s]}</option>
                ))}
              </select>
            </div>
            {source === 'client_referral' && (
              <div>
                <label className="mb-1 block text-sm font-medium">Tavsiye Eden Müvekkil</label>
                <select
                  {...register('referredByClientId')}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
                >
                  <option value="">Seçilmedi</option>
                  {clientsList.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.fullName}</option>
                  ))}
                </select>
              </div>
            )}
            {source === 'other' && (
              <div>
                <label className="mb-1 block text-sm font-medium">Kategori (ör. akraba, komşu)</label>
                <input
                  {...register('sourceDetail')}
                  placeholder="Kendi kategorinizi yazın"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
                />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Konu</label>
            <input
              {...register('subject')}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Notlar</label>
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Sonraki İşlem Tarihi</label>
            <input
              {...register('nextActionDate')}
              type="date"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={update.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-law-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ConsultationsPage() {
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data, isLoading, isError } = useConsultations({
    status: status || undefined,
    source: source || undefined,
  })
  const { data: stats } = useConsultationStats()
  const { data: clientsData } = useClients({ pageSize: 200 })

  const createConsultation = useCreateConsultation()
  const deleteConsultation = useDeleteConsultation()
  const convertConsultation = useConvertConsultation()

  const consultations = Array.isArray(data) ? data : data?.data || []
  const clientsList = clientsData?.data || []

  const defaultDate = new Date()
  defaultDate.setMinutes(defaultDate.getMinutes() - defaultDate.getTimezoneOffset())

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateConsultationInput>({
    resolver: zodResolver(createConsultationSchema),
    defaultValues: {
      consultationDate: defaultDate.toISOString().slice(0, 16),
      fullName: '',
      phone: '',
      type: 'phone',
      subject: '',
      notes: '',
      status: 'pending',
      source: '',
      sourceDetail: '',
      referredByClientId: '',
      nextActionDate: '',
    },
  })

  const formSource = watch('source')

  function onSubmit(formData: CreateConsultationInput) {
    createConsultation.mutate(formData, {
      onSuccess: () => {
        reset()
        setShowForm(false)
      },
    })
  }

  const today = stats?.today ?? 0
  const week = stats?.week ?? 0
  const month = stats?.month ?? 0
  const converted = stats?.converted ?? 0
  const weeklyGoal = stats?.weeklyGoal ?? 5
  const monthlyGoal = stats?.monthlyGoal ?? 20
  const dailyGoal = stats?.dailyGoal ?? 1
  const conversionRate = stats?.conversionRate ?? 0

  const weekPct = Math.min(100, Math.round((week / weeklyGoal) * 100))
  const monthPct = Math.min(100, Math.round((month / monthlyGoal) * 100))
  const todayPct = Math.min(100, Math.round((today / dailyGoal) * 100))

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Ön Görüşmeler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Müvekkil adaylarıyla yaptığınız görüşmeleri takip edin
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-law-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'İptal' : 'Yeni Görüşme'}
        </button>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarIcon className="h-3.5 w-3.5" />
              Bugün
            </div>
            <p className="mt-1.5 text-2xl font-bold">{today}<span className="text-sm text-muted-foreground">/{dailyGoal}</span></p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-law-accent transition-all"
                style={{ width: `${todayPct}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              Bu Hafta
            </div>
            <p className="mt-1.5 text-2xl font-bold">{week}<span className="text-sm text-muted-foreground">/{weeklyGoal}</span></p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${week >= weeklyGoal ? 'bg-emerald-500' : 'bg-law-accent'}`}
                style={{ width: `${weekPct}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              Bu Ay
            </div>
            <p className="mt-1.5 text-2xl font-bold">{month}<span className="text-sm text-muted-foreground">/{monthlyGoal}</span></p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${month >= monthlyGoal ? 'bg-emerald-500' : 'bg-law-accent'}`}
                style={{ width: `${monthPct}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Dönüşüm Oranı
            </div>
            <p className="mt-1.5 text-2xl font-bold text-emerald-600">{conversionRate}%</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {converted} / {month} müvekkil oldu
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Görüşme Ekleme Formu */}
      {showForm && (
        <Card className="border-law-accent/30 bg-law-accent/5">
          <CardContent className="p-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Ad Soyad <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('fullName')}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                    placeholder="Görüştüğünüz kişinin adı"
                    autoFocus
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Telefon</label>
                  <input
                    {...register('phone')}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                    placeholder="0555 000 00 00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Tarih & Saat <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('consultationDate')}
                    type="datetime-local"
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  />
                  {errors.consultationDate && (
                    <p className="mt-1 text-xs text-red-600">{errors.consultationDate.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Görüşme Tipi</label>
                  <select
                    {...register('type')}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  >
                    {consultationTypeValues.map((t) => (
                      <option key={t} value={t}>{consultationTypeLabels[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Durum</label>
                  <select
                    {...register('status')}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  >
                    {consultationStatusValues.map((s) => (
                      <option key={s} value={s}>{consultationStatusLabels[s]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Referans Kaynağı</label>
                  <select
                    {...register('source')}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  >
                    <option value="">Seçilmedi</option>
                    {consultationSourceValues.map((s) => (
                      <option key={s} value={s}>{consultationSourceLabels[s]}</option>
                    ))}
                  </select>
                </div>
                {formSource === 'client_referral' && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Tavsiye Eden Müvekkil</label>
                    <select
                      {...register('referredByClientId')}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                    >
                      <option value="">Seçilmedi</option>
                      {clientsList.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.fullName}</option>
                      ))}
                    </select>
                  </div>
                )}
                {formSource === 'other' && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Kategori (ör. akraba, komşu)</label>
                    <input
                      {...register('sourceDetail')}
                      placeholder="Kendi kategorinizi yazın"
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Konu</label>
                <input
                  {...register('subject')}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  placeholder="Örn: İşçilik alacağı, boşanma"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Notlar</label>
                <textarea
                  {...register('notes')}
                  rows={3}
                  className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  placeholder="Görüşmede konuşulanlar, dosyalar, öneriler..."
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Sonraki İşlem Tarihi</label>
                <input
                  {...register('nextActionDate')}
                  type="date"
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={createConsultation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-law-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {createConsultation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Görüşme Ekle
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filtreler */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
        >
          <option value="">Tüm Durumlar</option>
          {consultationStatusValues.map((s) => (
            <option key={s} value={s}>{consultationStatusLabels[s]}</option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
        >
          <option value="">Tüm Kaynaklar</option>
          {consultationSourceValues.map((s) => (
            <option key={s} value={s}>{consultationSourceLabels[s]}</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-2 h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">Görüşme listesi yüklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && (
        <>
          {consultations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <PhoneCall className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-muted-foreground">
                {status || source ? 'Sonuç bulunamadı' : 'Henüz görüşme kaydedilmemiş'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                {status || source ? 'Filtreleri değiştirin' : 'Yukarıdaki butona tıklayarak yeni görüşme ekleyin'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {consultations.map((c: any) => {
                if (editingId === c.id) {
                  return (
                    <EditConsultationForm
                      key={c.id}
                      consultation={c}
                      clientsList={clientsList}
                      onClose={() => setEditingId(null)}
                    />
                  )
                }

                const isConverted = c.status === 'converted' || !!c.convertedClientId

                return (
                  <Card key={c.id} className={isConverted ? 'border-emerald-200 bg-emerald-50/30' : ''}>
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-law-accent/10 text-law-accent">
                        {c.type === 'phone' ? (
                          <Phone className="h-4 w-4" />
                        ) : (
                          <Users className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{c.fullName}</p>
                          <Badge variant={statusVariant[c.status] || 'secondary'} className="text-[10px] px-1.5 py-0">
                            {consultationStatusLabels[c.status] || c.status}
                          </Badge>
                          {c.source && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {consultationSourceLabels[c.source] || c.source}
                            </Badge>
                          )}
                        </div>
                        {c.phone && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {c.phone}
                          </p>
                        )}
                        {c.subject && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {c.subject}
                          </p>
                        )}
                        {c.notes && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
                            {c.notes}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDateTime(c.consultationDate)}</span>
                          {c.referredByClientName && (
                            <span className="italic">
                              Tavsiye: {c.referredByClientName}
                            </span>
                          )}
                          {c.nextActionDate && (
                            <span className="inline-flex items-center gap-1 text-law-accent">
                              <CalendarIcon className="h-3 w-3" />
                              Sonraki: {formatDate(c.nextActionDate)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-shrink-0 gap-1">
                        {!isConverted && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`"${c.fullName}" kişisini müvekkil olarak kaydetmek istiyor musunuz?`)) {
                                convertConsultation.mutate(c.id)
                              }
                            }}
                            disabled={convertConsultation.isPending}
                            className="inline-flex h-10 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            aria-label="Müvekkil Yap"
                            title="Müvekkil Yap"
                          >
                            <UserPlus className="h-4 w-4" />
                            <span className="hidden sm:inline">Müvekkil Yap</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingId(c.id)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-law-accent/10 hover:text-law-accent"
                          aria-label="Düzenle"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Bu görüşmeyi silmek istediğinize emin misiniz?')) {
                              deleteConsultation.mutate(c.id)
                            }
                          }}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
