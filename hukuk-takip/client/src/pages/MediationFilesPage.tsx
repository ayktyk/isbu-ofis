import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createMediationFileSchema,
  mediationStatusValues,
  mediationTypeValues,
  type CreateMediationFileInput,
} from '@hukuk-takip/shared'
import {
  useMediationFiles,
  useCreateMediationFile,
  useUpdateMediationFile,
  useDeleteMediationFile,
  useMediationFileCollections,
  useCreateMediationCollection,
  useDeleteMediationCollection,
} from '@/hooks/useMediationFiles'
import { useMobileKeyboardFix } from '@/hooks/useMobileKeyboardFix'
import { MEDIATION_DISPUTE_TYPES } from '@/lib/constants/mediationData'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertTriangle,
  Banknote,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'

const mediationTypeLabels: Record<string, string> = {
  dava_sarti: 'Dava Sarti',
  ihtiyari: 'Ihtiyari',
}

const mediationStatusLabels: Record<string, string> = {
  active: 'Devam Ediyor',
  agreed: 'Anlasma',
  not_agreed: 'Anlasamama',
  partially_agreed: 'Kismen Anlasma',
  cancelled: 'Iptal',
}

const statusVariant: Record<string, 'default' | 'success' | 'danger' | 'warning' | 'secondary'> = {
  active: 'default',
  agreed: 'success',
  not_agreed: 'danger',
  partially_agreed: 'warning',
  cancelled: 'secondary',
}

function formatDateTR(dateStr?: string | null) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('tr-TR')
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTRY(val: number | string, currency = 'TRY') {
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (!Number.isFinite(n)) return '-'
  return `${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)} ${currency === 'TRY' ? '₺' : currency}`
}

export default function MediationFilesPage() {
  useMobileKeyboardFix()
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: files, isLoading, isError } = useMediationFiles({
    status: statusFilter || undefined,
  })
  const createFile = useCreateMediationFile()
  const deleteFile = useDeleteMediationFile()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateMediationFileInput>({
    resolver: zodResolver(createMediationFileSchema),
    defaultValues: {
      fileNo: '',
      mediationType: 'dava_sarti',
      disputeType: MEDIATION_DISPUTE_TYPES[0],
      disputeSubject: '',
      startDate: todayStr(),
      endDate: '',
      agreedFee: '',
      currency: 'TRY',
      notes: '',
      parties: [
        { side: 'applicant', fullName: '', tcNo: '', phone: '', email: '', address: '', lawyerName: '', lawyerBarNo: '', lawyerPhone: '' },
        { side: 'respondent', fullName: '', tcNo: '', phone: '', email: '', address: '', lawyerName: '', lawyerBarNo: '', lawyerPhone: '' },
      ],
    },
  })

  const { fields: partyFields, append: appendParty, remove: removeParty } = useFieldArray({
    control,
    name: 'parties',
  })

  function onSubmit(data: CreateMediationFileInput) {
    createFile.mutate(data, {
      onSuccess: () => {
        reset()
        setShowForm(false)
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Baslik */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Arabuluculuk Dosyalari</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Arabuluculuk dosya takibi ve taraf kayitlari
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-law-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Iptal' : 'Yeni Dosya'}
        </button>
      </div>

      {/* Yeni Dosya Formu */}
      {showForm && (
        <Card className="border-law-accent/30 bg-law-accent/5">
          <CardContent className="p-4 sm:p-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Dosya bilgileri */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Dosya No</label>
                  <input
                    {...register('fileNo')}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                    placeholder="2026/..."
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Arabuluculuk Türü <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('mediationType')}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  >
                    {mediationTypeValues.map((t) => (
                      <option key={t} value={t}>{mediationTypeLabels[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Uyuşmazlık Türü <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('disputeType')}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  >
                    {MEDIATION_DISPUTE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {errors.disputeType && (
                    <p className="mt-1 text-xs text-red-600">{errors.disputeType.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Baslangic Tarihi</label>
                  <input
                    {...register('startDate')}
                    type="date"
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                  />
                </div>
              </div>

              {/* Anlaşılan ücret */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">Anlasilan Ucret</label>
                  <input
                    {...register('agreedFee')}
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                  />
                  {errors.agreedFee && (
                    <p className="mt-1 text-xs text-red-600">{errors.agreedFee.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Para Birimi</label>
                  <select
                    {...register('currency')}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  >
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Uyusmazlik Konusu</label>
                <textarea
                  {...register('disputeSubject')}
                  rows={2}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20 resize-none"
                  placeholder="Uyusmazligin kisa aciklamasi..."
                />
              </div>

              {/* Taraflar */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Taraflar</h3>
                  <button
                    type="button"
                    onClick={() =>
                      appendParty({
                        side: 'respondent',
                        fullName: '',
                        tcNo: '',
                        phone: '',
                        email: '',
                        address: '',
                        lawyerName: '',
                        lawyerBarNo: '',
                        lawyerPhone: '',
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Taraf Ekle
                  </button>
                </div>

                {errors.parties?.message && (
                  <p className="mb-2 text-xs text-red-600">{errors.parties.message}</p>
                )}

                <div className="space-y-4">
                  {partyFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="rounded-lg border bg-background p-3 sm:p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <select
                            {...register(`parties.${index}.side`)}
                            className="rounded-md border bg-muted px-2 py-1 text-xs font-medium outline-none focus:border-law-accent"
                          >
                            <option value="applicant">Basvurucu</option>
                            <option value="respondent">Karsi Taraf</option>
                          </select>
                          {errors.parties?.[index]?.fullName && (
                            <span className="text-xs text-red-600">
                              {errors.parties[index].fullName?.message}
                            </span>
                          )}
                        </div>
                        {partyFields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeParty(index)}
                            className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <input
                          {...register(`parties.${index}.fullName`)}
                          placeholder="Ad Soyad *"
                          className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-law-accent"
                        />
                        <input
                          {...register(`parties.${index}.tcNo`)}
                          placeholder="TC No"
                          className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-law-accent"
                        />
                        <input
                          {...register(`parties.${index}.phone`)}
                          placeholder="Telefon"
                          className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-law-accent"
                        />
                        <input
                          {...register(`parties.${index}.email`)}
                          placeholder="E-posta"
                          className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-law-accent"
                        />
                        <input
                          {...register(`parties.${index}.lawyerName`)}
                          placeholder="Vekil Adi"
                          className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-law-accent"
                        />
                        <input
                          {...register(`parties.${index}.lawyerBarNo`)}
                          placeholder="Baro Sicil No"
                          className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-law-accent"
                        />
                        <input
                          {...register(`parties.${index}.lawyerPhone`)}
                          placeholder="Vekil Telefonu"
                          className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-law-accent"
                        />
                      </div>

                      <textarea
                        {...register(`parties.${index}.address`)}
                        placeholder="Adres"
                        rows={1}
                        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-law-accent resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Notlar</label>
                <textarea
                  {...register('notes')}
                  rows={2}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20 resize-none"
                  placeholder="Dosya hakkinda notlar..."
                />
              </div>

              <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t bg-law-accent/5 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:-mx-5 sm:static sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0">
                <button
                  type="submit"
                  disabled={createFile.isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-law-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 sm:w-auto"
                >
                  {createFile.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Dosya Olustur
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filtreler */}
      <div className="flex gap-1.5 overflow-x-auto sm:gap-2">
        {[
          { value: '', label: 'Tümü' },
          { value: 'active', label: 'Devam Eden' },
          { value: 'agreed', label: 'Anlasma' },
          { value: 'not_agreed', label: 'Anlasamama' },
          { value: 'partially_agreed', label: 'Kismen' },
          { value: 'cancelled', label: 'Iptal' },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition sm:px-3.5 sm:py-2 sm:text-sm ${
              statusFilter === opt.value
                ? 'bg-law-primary text-white shadow-sm'
                : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground border'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">Dosyalar yuklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {/* Liste */}
      {!isLoading && !isError && (
        <>
          {!files?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-muted-foreground">
                {statusFilter ? 'Sonuc bulunamadi' : 'Henuz arabuluculuk dosyasi yok'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                {statusFilter ? 'Filtreleri degistirin' : 'Yukardaki butona tiklayarak yeni dosya ekleyin'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file: any) => {
                const isExpanded = expandedId === file.id
                const applicants = file.parties?.filter((p: any) => p.side === 'applicant') || []
                const respondents = file.parties?.filter((p: any) => p.side === 'respondent') || []

                return (
                  <Card key={file.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {/* Ozet satiri */}
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : file.id)}
                        className="flex w-full items-start gap-3 p-3 text-left transition hover:bg-muted/50 sm:items-center sm:p-4"
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-law-accent/10">
                          <FileText className="h-5 w-5 text-law-accent" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">
                              {file.fileNo || 'Dosya No Yok'}
                            </p>
                            <Badge variant={statusVariant[file.status] || 'secondary'}>
                              {mediationStatusLabels[file.status] || file.status}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {mediationTypeLabels[file.mediationType]}
                            </Badge>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {file.disputeType}
                            {applicants.length > 0 && ` — ${applicants.map((p: any) => p.fullName).join(', ')}`}
                            {respondents.length > 0 && ` vs ${respondents.map((p: any) => p.fullName).join(', ')}`}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatDateTR(file.startDate)}
                            {file.endDate ? ` — ${formatDateTR(file.endDate)}` : ''}
                            {file.agreedFee ? ` • ${formatTRY(file.agreedFee, file.currency)}` : ''}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        )}
                      </button>

                      {/* Detay */}
                      {isExpanded && (
                        <div className="border-t bg-muted/30 p-3 sm:p-4">
                          {/* Taraflar */}
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {/* Basvurucular */}
                            <div>
                              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Basvurucu Taraf
                              </h4>
                              {applicants.length === 0 ? (
                                <p className="text-xs text-muted-foreground">-</p>
                              ) : (
                                <div className="space-y-2">
                                  {applicants.map((p: any) => (
                                    <PartyCard key={p.id} party={p} />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Karsi taraf */}
                            <div>
                              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Karsi Taraf
                              </h4>
                              {respondents.length === 0 ? (
                                <p className="text-xs text-muted-foreground">-</p>
                              ) : (
                                <div className="space-y-2">
                                  {respondents.map((p: any) => (
                                    <PartyCard key={p.id} party={p} />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Uyusmazlik konusu */}
                          {file.disputeSubject && (
                            <div className="mt-3">
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Uyusmazlik Konusu
                              </h4>
                              <p className="text-sm">{file.disputeSubject}</p>
                            </div>
                          )}

                          {/* Notlar */}
                          {file.notes && (
                            <div className="mt-3">
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Notlar
                              </h4>
                              <p className="text-sm">{file.notes}</p>
                            </div>
                          )}

                          {/* Ucret & Tahsilat */}
                          <div className="mt-4 border-t pt-3">
                            <MediationFinancePanel
                              fileId={file.id}
                              agreedFee={file.agreedFee}
                              currency={file.currency || 'TRY'}
                            />
                          </div>

                          {/* Durum degistir + sil */}
                          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                            <StatusChanger
                              fileId={file.id}
                              currentStatus={file.status}
                            />
                            <button
                              onClick={() => {
                                if (confirm('Bu dosyayi silmek istediginize emin misiniz?')) {
                                  deleteFile.mutate(file.id)
                                  setExpandedId(null)
                                }
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Sil
                            </button>
                          </div>
                        </div>
                      )}
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

function PartyCard({ party }: { party: any }) {
  return (
    <div className="rounded-lg border bg-card p-2.5 text-sm">
      <p className="font-medium">{party.fullName}</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        {party.tcNo && <span>TC: {party.tcNo}</span>}
        {party.phone && <span>Tel: {party.phone}</span>}
        {party.email && <span>{party.email}</span>}
      </div>
      {party.lawyerName && (
        <p className="mt-1 text-xs text-muted-foreground">
          Vekil: {party.lawyerName}
          {party.lawyerBarNo ? ` (${party.lawyerBarNo})` : ''}
          {party.lawyerPhone ? ` — Tel: ${party.lawyerPhone}` : ''}
        </p>
      )}
      {party.address && (
        <p className="mt-1 text-xs text-muted-foreground">{party.address}</p>
      )}
    </div>
  )
}

function MediationFinancePanel({
  fileId,
  agreedFee,
  currency,
}: {
  fileId: string
  agreedFee: string | null | undefined
  currency: string
}) {
  const { data: collections, isLoading } = useMediationFileCollections(fileId)
  const createCollection = useCreateMediationCollection()
  const deleteCollection = useDeleteMediationCollection(fileId)
  const updateFile = useUpdateMediationFile(fileId)

  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [description, setDescription] = useState('')
  const [method, setMethod] = useState('cash')

  const [editingFee, setEditingFee] = useState(false)
  const [feeInput, setFeeInput] = useState(agreedFee || '')

  const agreedFeeNum = parseFloat(agreedFee || '0')
  const collected = (collections || []).reduce(
    (sum, c) => sum + parseFloat(c.amount || '0'),
    0
  )
  const remaining = agreedFeeNum - collected
  const progress = agreedFeeNum > 0 ? Math.min(100, (collected / agreedFeeNum) * 100) : 0

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !date) return
    createCollection.mutate(
      { mediationFileId: fileId, amount, collectionDate: date, description, paymentMethod: method, currency },
      {
        onSuccess: () => {
          setAmount('')
          setDescription('')
          setShowForm(false)
        },
      }
    )
  }

  function handleSaveFee() {
    updateFile.mutate(
      { agreedFee: feeInput || '', currency },
      {
        onSuccess: () => setEditingFee(false),
      }
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Banknote className="h-3.5 w-3.5" />
          Ucret ve Tahsilat
        </h4>
        {!editingFee ? (
          <button
            type="button"
            onClick={() => {
              setFeeInput(agreedFee || '')
              setEditingFee(true)
            }}
            className="text-[11px] font-medium text-law-accent hover:underline"
          >
            {agreedFee ? 'Ucreti duzenle' : 'Anlasilan ucret gir'}
          </button>
        ) : null}
      </div>

      {editingFee ? (
        <div className="mb-3 rounded-lg border bg-card p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              inputMode="decimal"
              placeholder="Anlasilan ucret"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingFee(false)}
                className="flex-1 rounded-lg border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted sm:flex-initial"
              >
                Iptal
              </button>
              <button
                type="button"
                onClick={handleSaveFee}
                disabled={updateFile.isPending}
                className="flex-1 rounded-lg bg-law-accent px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 sm:flex-initial"
              >
                {updateFile.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      ) : agreedFee ? (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border bg-card p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Anlasilan</p>
              <p className="text-sm font-semibold text-foreground">
                {formatTRY(agreedFeeNum, currency)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Tahsil</p>
              <p className="text-sm font-semibold text-law-success">
                {formatTRY(collected, currency)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Kalan</p>
              <p className={`text-sm font-semibold ${remaining > 0 ? 'text-law-warning' : 'text-law-success'}`}>
                {formatTRY(remaining, currency)}
              </p>
            </div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-law-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      ) : (
        <p className="rounded-lg border bg-card p-3 text-center text-xs text-muted-foreground">
          Henuz anlasilan ucret girilmedi.
        </p>
      )}

      {/* Tahsilat listesi + ekleme */}
      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Tahsilatlar</p>
          {agreedFee ? (
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-law-accent hover:underline"
            >
              {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showForm ? 'Iptal' : 'Ekle'}
            </button>
          ) : null}
        </div>

        {showForm && (
          <form
            onSubmit={handleAdd}
            className="mb-2 rounded-lg border bg-card p-2.5 space-y-2"
          >
            <div className="grid grid-cols-2 gap-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Tutar"
                inputMode="decimal"
                required
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-law-accent"
              />
              <input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                type="date"
                required
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-law-accent"
              />
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-law-accent"
              >
                <option value="cash">Nakit</option>
                <option value="bank_transfer">Havale/EFT</option>
                <option value="check">Cek</option>
                <option value="credit_card">Kredi Karti</option>
              </select>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Aciklama"
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-law-accent"
              />
            </div>
            <button
              type="submit"
              disabled={createCollection.isPending || !amount}
              className="w-full rounded-lg bg-law-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {createCollection.isPending ? 'Kaydediliyor...' : 'Tahsilat Kaydet'}
            </button>
          </form>
        )}

        {isLoading ? (
          <p className="text-center text-xs text-muted-foreground">Yukleniyor...</p>
        ) : !collections?.length ? (
          <p className="rounded-lg border bg-card p-2 text-center text-xs text-muted-foreground">
            Henuz tahsilat yok.
          </p>
        ) : (
          <ul className="space-y-1">
            {collections.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border bg-card px-2.5 py-1.5 text-xs"
              >
                <div>
                  <span className="font-semibold">{formatTRY(c.amount, c.currency)}</span>
                  <span className="ml-2 text-muted-foreground">{formatDateTR(c.collectionDate)}</span>
                  {c.description && <span className="ml-2 text-muted-foreground">— {c.description}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Bu tahsilati silmek istiyor musunuz?')) {
                      deleteCollection.mutate(c.id)
                    }
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatusChanger({ fileId, currentStatus }: { fileId: string; currentStatus: string }) {
  const updateFile = useUpdateMediationFile(fileId)
  const [newStatus, setNewStatus] = useState(currentStatus)

  function handleChange(value: string) {
    setNewStatus(value)
    updateFile.mutate({ status: value as any })
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Durum:</span>
      <select
        value={newStatus}
        onChange={(e) => handleChange(e.target.value)}
        disabled={updateFile.isPending}
        className="rounded-lg border bg-card px-2 py-1 text-xs font-medium outline-none focus:border-law-accent disabled:opacity-50"
      >
        {mediationStatusValues.map((s) => (
          <option key={s} value={s}>{mediationStatusLabels[s]}</option>
        ))}
      </select>
      {updateFile.isPending && <Loader2 className="h-3 w-3 animate-spin text-law-accent" />}
    </div>
  )
}
