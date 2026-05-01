import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, Pencil, Save, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useCases } from '@/hooks/useCases'
import { previewDeadline, useCreateTask, useDeadlineTemplates } from '@/hooks/useTasks'
import {
  deadlineCategoryLabels,
  deadlineSeverityLabels,
  formatDate,
  localInputToISO,
  trNormalize,
} from '@/lib/utils'

interface Template {
  key: string
  label: string
  category: string
  severity: string
  durationDays: number
  durationYears?: number
  triggerLabel: string
  legalBasis: string
  applyHolidayShift: boolean
  description?: string
  suggestedFor?: string[]
}

interface Preview {
  template: Template
  rawDueDate: string
  adjustedDueDate: string
  wasShifted: boolean
}

const CATEGORY_ORDER = ['icra', 'hukuk', 'is', 'ceza', 'idari', 'tbk'] as const

export function NewLegalDeadlineForm({
  onClose,
  defaultCaseId,
}: {
  onClose: () => void
  defaultCaseId?: string
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [isManual, setIsManual] = useState(false)
  const [triggerDate, setTriggerDate] = useState('')
  const [caseId, setCaseId] = useState(defaultCaseId || '')
  const [triggerEventLabel, setTriggerEventLabel] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [manualDueDate, setManualDueDate] = useState('')
  const [manualSeverity, setManualSeverity] = useState<'hak_dusurucu' | 'zamanasimi' | 'usul'>(
    'hak_dusurucu'
  )
  const [manualCategory, setManualCategory] = useState<string>('hukuk')
  const [manualLegalBasis, setManualLegalBasis] = useState('')
  const [manualDescription, setManualDescription] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [acceptShift, setAcceptShift] = useState(true)

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    const prevPosition = document.body.style.position
    const prevTop = document.body.style.top
    const prevWidth = document.body.style.width
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'

    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.position = prevPosition
      document.body.style.top = prevTop
      document.body.style.width = prevWidth
      window.scrollTo(0, scrollY)
    }
  }, [])

  const { data: templates, isLoading: templatesLoading } = useDeadlineTemplates()
  const { data: casesData } = useCases({ pageSize: 200 })
  const casesList = casesData?.data || []
  const createTask = useCreateTask()
  const selectedCase = useMemo(
    () => casesList.find((item: any) => item.id === caseId),
    [caseId, casesList]
  )

  const filteredTemplates: Template[] = (templates || [])
    .filter((template: Template) => {
      if (activeCategory && template.category !== activeCategory) return false
      if (!search) return true

      const query = trNormalize(search)
      return (
        trNormalize(template.label).includes(query) ||
        trNormalize(template.legalBasis).includes(query) ||
        trNormalize(template.triggerLabel).includes(query) ||
        trNormalize(template.description || '').includes(query)
      )
    })
    .sort((a: Template, b: Template) => {
      const aIndex = CATEGORY_ORDER.indexOf(a.category as (typeof CATEGORY_ORDER)[number])
      const bIndex = CATEGORY_ORDER.indexOf(b.category as (typeof CATEGORY_ORDER)[number])
      return aIndex - bIndex
    })

  const suggestedTemplates = useMemo(() => {
    if (!selectedCase?.caseType) return []
    return (templates || []).filter((template: Template) =>
      template.suggestedFor?.includes(selectedCase.caseType)
    )
  }, [selectedCase, templates])

  function goManual(title = '') {
    setIsManual(true)
    setSelectedTemplate(null)
    setPreview(null)
    setTriggerEventLabel(triggerEventLabel || 'Tetikleyici olay')
    if (title) {
      setCustomTitle(title)
    }
    setStep(2)
  }

  function goTemplate(tpl: Template) {
    setIsManual(false)
    setSelectedTemplate(tpl)
    setTriggerEventLabel(tpl.triggerLabel)
    setPreview(null)
    setAcceptShift(true)
    setStep(2)
  }

  async function handleNextFromStep2() {
    if (!selectedTemplate) return
    if (!triggerDate) {
      toast.error('Tetikleyici tarih zorunlu.')
      return
    }

    setPreviewLoading(true)
    try {
      const result = await previewDeadline(selectedTemplate.key, triggerDate)
      setPreview(result)
      setAcceptShift(result.wasShifted)
    } catch (error) {
      console.error(error)
      toast.error('Süre hesaplanamadı.')
    } finally {
      setPreviewLoading(false)
    }
  }

  function handleSubmit() {
    if (isManual) {
      const title = customTitle.trim()
      if (!title) {
        toast.error('Başlık zorunlu.')
        return
      }
      if (!manualDueDate) {
        toast.error('Son gün zorunlu.')
        return
      }

      createTask.mutate(
        {
          title,
          description: manualDescription.trim(),
          priority: 'urgent',
          caseId: caseId || '',
          dueDate: localInputToISO(`${manualDueDate}T09:00`),
          isDeadline: true,
          deadlineTemplateKey: '',
          deadlineCategory: manualCategory as any,
          deadlineSeverity: manualSeverity as any,
          triggerEventDate: triggerDate || '',
          triggerEventLabel: triggerEventLabel.trim(),
          calculatedDueDate: manualDueDate,
          adjustedForHoliday: false,
          legalBasis: manualLegalBasis.trim(),
        } as any,
        { onSuccess: onClose }
      )
      return
    }

    if (!preview || !selectedTemplate) return

    const finalDueDate = acceptShift ? preview.adjustedDueDate : preview.rawDueDate
    createTask.mutate(
      {
        title: customTitle.trim() || selectedTemplate.label,
        priority: 'urgent',
        caseId: caseId || '',
        dueDate: localInputToISO(`${finalDueDate}T09:00`),
        isDeadline: true,
        deadlineTemplateKey: selectedTemplate.key,
        deadlineCategory: selectedTemplate.category as any,
        deadlineSeverity: selectedTemplate.severity as any,
        triggerEventDate: triggerDate,
        triggerEventLabel: triggerEventLabel.trim() || selectedTemplate.triggerLabel,
        calculatedDueDate: preview.rawDueDate,
        adjustedForHoliday: acceptShift && preview.wasShifted,
        legalBasis: selectedTemplate.legalBasis,
      } as any,
      { onSuccess: onClose }
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      <div className="absolute inset-0 sm:hidden" onClick={onClose} aria-hidden="true" />
      <Card className="absolute inset-0 flex flex-col overflow-hidden rounded-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:w-full sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:shadow-xl">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div className="flex flex-shrink-0 items-center justify-between border-b bg-card px-4 pb-3 pt-4 sm:px-5">
            <div>
              <h2 className="text-lg font-semibold text-law-primary">
                Yeni Süreli İş {isManual ? '- Manuel' : `- Adım ${step}/2`}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isManual
                  ? 'Manuel süreli iş kaydı oluşturun'
                  : step === 1
                    ? 'Şablon seçin veya arayın'
                    : 'Tetikleyici tarihi girin ve önizlemeyi kontrol edin'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 border-b bg-card px-4 py-3 sm:px-5">
            {[1, 2].map((item) => (
              <div
                key={item}
                className={`h-1.5 flex-1 rounded-full ${item <= step ? 'bg-law-accent' : 'bg-muted'}`}
              />
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {step === 1 && !isManual && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => goManual()}
                  className="flex w-full items-center justify-between rounded-lg border-2 border-dashed border-law-accent/50 bg-law-accent/5 p-3 text-left transition-colors hover:bg-law-accent/10"
                >
                  <div>
                    <p className="text-sm font-medium text-law-accent">+ Manuel olarak ekle</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Hazır şablon yoksa son günü ve başlığı siz girin
                    </p>
                  </div>
                  <Pencil className="h-4 w-4 text-law-accent" />
                </button>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">İlgili Dava (opsiyonel)</label>
                  <select
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  >
                    <option value="">Dava seçilmedi</option>
                    {casesList.map((item: any) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Şablon ara: itiraz, istinaf, zamanaşımı..."
                    className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-law-accent"
                  />
                </div>

                {suggestedTemplates.length > 0 && !search && !activeCategory && (
                  <Card className="border-law-accent/20 bg-law-accent/5">
                    <CardContent className="p-3">
                      <p className="text-xs font-medium text-law-primary">
                        Seçili dava için önerilen şablonlar
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {suggestedTemplates.slice(0, 4).map((template: Template) => (
                          <button
                            key={template.key}
                            type="button"
                            onClick={() => goTemplate(template)}
                            className="rounded-full border border-law-accent/30 bg-white px-3 py-1 text-xs font-medium text-law-primary hover:bg-law-accent/10"
                          >
                            {template.label}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setActiveCategory('')}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      !activeCategory ? 'bg-law-accent text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    Tumu
                  </button>
                  {CATEGORY_ORDER.map((category) => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category === activeCategory ? '' : category)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        activeCategory === category
                          ? 'bg-law-accent text-white'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {deadlineCategoryLabels[category] || category}
                    </button>
                  ))}
                </div>

                <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                  {templatesLoading && (
                    <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</p>
                  )}

                  {!templatesLoading && filteredTemplates.length === 0 && (
                    <div className="py-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        "{search || '...'}" için eşleşen hazır şablon yok.
                      </p>
                      <button
                        type="button"
                        onClick={() => goManual(search)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-law-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Manuel olarak ekle
                      </button>
                    </div>
                  )}

                  {filteredTemplates.map((template) => (
                    <button
                      key={template.key}
                      onClick={() => goTemplate(template)}
                      className="block w-full rounded-lg border bg-background p-3 text-left transition-colors hover:border-law-accent hover:bg-law-accent/5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-law-primary">{template.label}</span>
                        <Badge
                          variant={template.severity === 'hak_dusurucu' ? 'danger' : 'warning'}
                          className="px-1.5 py-0 text-[10px]"
                        >
                          {deadlineSeverityLabels[template.severity] || template.severity}
                        </Badge>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {deadlineCategoryLabels[template.category] || template.category}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <strong>
                          {template.durationYears
                            ? `${template.durationYears} yil`
                            : `${template.durationDays} gun`}
                        </strong>{' '}
                        · {template.triggerLabel} · {template.legalBasis}
                      </p>
                      {template.description && (
                        <p className="mt-1 text-xs text-muted-foreground/80">{template.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && isManual && (
              <div className="space-y-4">
                <Card className="border-law-accent/30 bg-law-accent/5">
                  <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">
                      Manuel modda son günü siz belirlersiniz. Sistem hesap yapmaz; kayıt yine
                      süreli iş olarak tutulur.
                    </p>
                  </CardContent>
                </Card>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Başlık <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Örn: Bilirkişi raporuna itiraz"
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Tetikleyici Tarih (opsiyonel)</label>
                    <input
                      type="date"
                      value={triggerDate}
                      onChange={(e) => setTriggerDate(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Son Gün <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={manualDueDate}
                      onChange={(e) => setManualDueDate(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Tetikleyici Olay Etiketi (opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={triggerEventLabel}
                    onChange={(e) => setTriggerEventLabel(e.target.value)}
                    placeholder="Örn: Tebliğ tarihi"
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Kategori</label>
                    <select
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                    >
                      {CATEGORY_ORDER.map((category) => (
                        <option key={category} value={category}>
                          {deadlineCategoryLabels[category] || category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Şiddet</label>
                    <select
                      value={manualSeverity}
                      onChange={(e) => setManualSeverity(e.target.value as typeof manualSeverity)}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                    >
                      <option value="hak_dusurucu">Hak düşürücü</option>
                      <option value="zamanasimi">Zamanaşımı</option>
                      <option value="usul">Usul</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Yasal Dayanak (opsiyonel)</label>
                    <input
                      type="text"
                      value={manualLegalBasis}
                      onChange={(e) => setManualLegalBasis(e.target.value)}
                      placeholder="Örn: HMK m.281"
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">İlgili Dava (opsiyonel)</label>
                    <select
                      value={caseId}
                      onChange={(e) => setCaseId(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                    >
                      <option value="">Dava seçilmedi</option>
                      {casesList.map((item: any) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Açıklama (opsiyonel)</label>
                  <textarea
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    rows={3}
                    placeholder="Notlar, hangi işlem yapılacak, hatırlatma..."
                    className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent"
                  />
                </div>
              </div>
            )}

            {step === 2 && !isManual && selectedTemplate && (
              <div className="space-y-4">
                <Card className="border-law-accent/30 bg-law-accent/5">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium text-law-primary">{selectedTemplate.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {selectedTemplate.durationYears
                        ? `${selectedTemplate.durationYears} yıl`
                        : `${selectedTemplate.durationDays} gün`}{' '}
                      · {selectedTemplate.legalBasis}
                    </p>
                  </CardContent>
                </Card>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {selectedTemplate.triggerLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={triggerDate}
                    onChange={(e) => {
                      setTriggerDate(e.target.value)
                      setPreview(null)
                    }}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Süre bu tarihten itibaren işlemeye başlar.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">İlgili Dava (opsiyonel)</label>
                  <select
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  >
                    <option value="">Dava seçilmedi</option>
                    {casesList.map((item: any) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Görev Başlığı (opsiyonel)</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder={selectedTemplate.label}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Boş bırakılırsa şablon adı kullanılır.
                  </p>
                </div>

                {preview && (
                  <div className="space-y-4">
                    <Card className="border-red-300 bg-red-50">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-red-700">
                              {selectedTemplate.label} - Hesaplanan Son Gün
                            </p>
                            <div className="mt-2 space-y-1 text-sm text-red-900">
                              <p>
                                <span className="text-xs text-red-700/70">
                                  {selectedTemplate.triggerLabel}:
                                </span>{' '}
                                <strong>{formatDate(triggerDate)}</strong>
                              </p>
                              <p>
                                <span className="text-xs text-red-700/70">Ham son gün:</span>{' '}
                                <strong>{formatDate(preview.rawDueDate)}</strong>
                              </p>
                              {preview.wasShifted && (
                                <p>
                                  <span className="text-xs text-red-700/70">
                                    Tatil sonrası ilk iş günü:
                                  </span>{' '}
                                  <strong>{formatDate(preview.adjustedDueDate)}</strong>
                                </p>
                              )}
                            </div>

                            {preview.wasShifted && (
                              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-red-300 bg-white p-2.5 text-sm">
                                <input
                                  type="checkbox"
                                  checked={acceptShift}
                                  onChange={(e) => setAcceptShift(e.target.checked)}
                                  className="mt-0.5"
                                />
                                <span>
                                  <strong>Tatil ötelemeyi uygula</strong>{' '}
                                  <span className="text-xs text-muted-foreground">
                                    Son gün tatil/hafta sonuna geldiği için kayıt{' '}
                                    <strong>{formatDate(preview.adjustedDueDate)}</strong> olarak tutulur.
                                  </span>
                                </span>
                              </label>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                      Süreler avukatın sorumluluğundadır. Sistem yalnızca hesap yardımı sunar; özel
                      usul ve tatil durumlarını son kez kontrol edin.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center justify-between border-t bg-card px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-5">
            <button
              onClick={() => {
                if (step === 1) {
                  onClose()
                  return
                }

                if (isManual && step === 2) {
                  setIsManual(false)
                  setPreview(null)
                  setStep(1)
                  return
                }

                setStep((step - 1) as 1 | 2)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50"
            >
              <ArrowLeft className="h-4 w-4" />
              {step === 1 ? 'İptal' : 'Geri'}
            </button>

            {step === 2 && isManual && (
              <button
                onClick={handleSubmit}
                disabled={createTask.isPending || !customTitle.trim() || !manualDueDate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {createTask.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Kaydet
              </button>
            )}

            {step === 2 && !isManual && !preview && (
              <button
                onClick={handleNextFromStep2}
                disabled={!triggerDate || previewLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-law-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {previewLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Hesapla
              </button>
            )}

            {step === 2 && !isManual && preview && (
              <button
                onClick={handleSubmit}
                disabled={createTask.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {createTask.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Süreli İş Olarak Kaydet
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
