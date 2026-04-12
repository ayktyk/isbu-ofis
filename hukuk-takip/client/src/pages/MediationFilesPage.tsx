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
} from '@/hooks/useMediationFiles'
import { MEDIATION_DISPUTE_TYPES } from '@/lib/constants/mediationData'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertTriangle,
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

export default function MediationFilesPage() {
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
      notes: '',
      parties: [
        { side: 'applicant', fullName: '', tcNo: '', phone: '', email: '', address: '', lawyerName: '', lawyerBarNo: '' },
        { side: 'respondent', fullName: '', tcNo: '', phone: '', email: '', address: '', lawyerName: '', lawyerBarNo: '' },
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
                    Arabuluculuk Turu <span className="text-red-500">*</span>
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
                    Uyusmazlik Turu <span className="text-red-500">*</span>
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

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={createFile.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-law-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
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
          { value: '', label: 'Tumu' },
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
                : 'bg-white text-muted-foreground hover:bg-slate-100 hover:text-foreground border'
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
                        className="flex w-full items-start gap-3 p-3 text-left transition hover:bg-slate-50 sm:items-center sm:p-4"
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
                        <div className="border-t bg-slate-50/50 p-3 sm:p-4">
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
    <div className="rounded-lg border bg-white p-2.5 text-sm">
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
        </p>
      )}
      {party.address && (
        <p className="mt-1 text-xs text-muted-foreground">{party.address}</p>
      )}
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
        className="rounded-lg border bg-white px-2 py-1 text-xs font-medium outline-none focus:border-law-accent disabled:opacity-50"
      >
        {mediationStatusValues.map((s) => (
          <option key={s} value={s}>{mediationStatusLabels[s]}</option>
        ))}
      </select>
      {updateFile.isPending && <Loader2 className="h-3 w-3 animate-spin text-law-accent" />}
    </div>
  )
}
