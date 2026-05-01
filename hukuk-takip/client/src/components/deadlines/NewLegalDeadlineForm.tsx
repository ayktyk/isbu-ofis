import { useState } from 'react'
import { useDeadlineTemplates, previewDeadline, useCreateTask } from '@/hooks/useTasks'
import { useCases } from '@/hooks/useCases'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { deadlineCategoryLabels, deadlineSeverityLabels, formatDate } from '@/lib/utils'
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, Save, Search, X } from 'lucide-react'
import { toast } from 'sonner'

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
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('')

  const [triggerDate, setTriggerDate] = useState('')
  const [caseId, setCaseId] = useState(defaultCaseId || '')
  const [triggerEventLabel, setTriggerEventLabel] = useState('')
  const [customTitle, setCustomTitle] = useState('')

  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [acceptShift, setAcceptShift] = useState(true)

  const { data: templates, isLoading: templatesLoading } = useDeadlineTemplates()
  const { data: casesData } = useCases({ pageSize: 200 })
  const casesList = casesData?.data || []
  const createTask = useCreateTask()

  const filteredTemplates: Template[] = (templates || [])
    .filter((t: Template) => {
      if (activeCategory && t.category !== activeCategory) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.label.toLowerCase().includes(q) ||
          t.legalBasis.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
        )
      }
      return true
    })
    .sort((a: Template, b: Template) => {
      const ai = CATEGORY_ORDER.indexOf(a.category as any)
      const bi = CATEGORY_ORDER.indexOf(b.category as any)
      return ai - bi
    })

  async function handleNextFromStep1(tpl: Template) {
    setSelectedTemplate(tpl)
    setTriggerEventLabel(tpl.triggerLabel)
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
      setStep(3)
    } catch (err) {
      console.error(err)
      toast.error('Süre hesaplanamadı.')
    } finally {
      setPreviewLoading(false)
    }
  }

  function handleSubmit() {
    if (!preview || !selectedTemplate) return
    const finalDue = acceptShift ? preview.adjustedDueDate : preview.rawDueDate
    const dueDate = new Date(`${finalDue}T09:00:00`)

    const title = customTitle.trim() || selectedTemplate.label
    createTask.mutate(
      {
        title,
        priority: 'urgent',
        caseId: caseId || '',
        dueDate: dueDate.toISOString(),
        isDeadline: true,
        deadlineTemplateKey: selectedTemplate.key,
        deadlineCategory: selectedTemplate.category as any,
        deadlineSeverity: selectedTemplate.severity as any,
        triggerEventDate: triggerDate,
        triggerEventLabel: triggerEventLabel || selectedTemplate.triggerLabel,
        calculatedDueDate: preview.rawDueDate,
        adjustedForHoliday: acceptShift && preview.wasShifted,
        legalBasis: selectedTemplate.legalBasis,
      } as any,
      {
        onSuccess: () => {
          toast.success('Süreli iş eklendi.')
          onClose()
        },
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <Card className="w-full max-w-3xl">
        <CardContent className="p-5">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-law-primary">
                Yeni Süreli İş — Adım {step}/3
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {step === 1 && 'Süreli iş türünü seçin'}
                {step === 2 && 'Tetikleyici tarihi girin'}
                {step === 3 && 'Hesaplanan son günü onaylayın'}
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

          {/* Stepper indicator */}
          <div className="mb-5 flex items-center gap-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full ${
                  n <= step ? 'bg-law-accent' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Step 1 — Template selection */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Şablon ara — itiraz, istinaf, zamanaşımı..."
                    className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-law-accent"
                  />
                </div>
              </div>

              {/* Kategori filtre chip'leri */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveCategory('')}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    !activeCategory ? 'bg-law-accent text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  Tümü
                </button>
                {CATEGORY_ORDER.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat === activeCategory ? '' : cat)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      activeCategory === cat ? 'bg-law-accent text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {deadlineCategoryLabels[cat] || cat}
                  </button>
                ))}
              </div>

              <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                {templatesLoading && (
                  <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
                )}
                {!templatesLoading && filteredTemplates.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Eşleşen şablon yok.
                  </p>
                )}
                {filteredTemplates.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => handleNextFromStep1(t)}
                    className="block w-full rounded-lg border bg-background p-3 text-left transition-colors hover:border-law-accent hover:bg-law-accent/5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-law-primary">{t.label}</span>
                      <Badge
                        variant={t.severity === 'hak_dusurucu' ? 'danger' : 'warning'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {deadlineSeverityLabels[t.severity] || t.severity}
                      </Badge>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {deadlineCategoryLabels[t.category] || t.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <strong>
                        {t.durationYears ? `${t.durationYears} yıl` : `${t.durationDays} gün`}
                      </strong>{' '}
                      · {t.triggerLabel} · {t.legalBasis}
                    </p>
                    {t.description && (
                      <p className="mt-1 text-xs text-muted-foreground/80">{t.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Trigger date */}
          {step === 2 && selectedTemplate && (
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
                  onChange={(e) => setTriggerDate(e.target.value)}
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
                  {casesList.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Görev başlığı (opsiyonel)
                </label>
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
            </div>
          )}

          {/* Step 3 — Preview & confirm */}
          {step === 3 && preview && selectedTemplate && (
            <div className="space-y-4">
              <Card className="border-red-300 bg-red-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-700">
                        {selectedTemplate.label} — Hesaplanan Son Gün
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
                              Hafta sonu/tatil sonrası ilk iş günü:
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
                            <strong>Tatil ötelemesini uygula</strong> —
                            <span className="text-xs text-muted-foreground">
                              {' '}
                              Son gün hafta sonu/resmi tatile denk geldi. Onaylarsanız son gün{' '}
                              <strong>{formatDate(preview.adjustedDueDate)}</strong> olarak kaydedilir.
                            </span>
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p>
                  ⚠ Süreler avukatın sorumluluğundadır. Sistem tahmini hesap yapar; mahkeme
                  tatilleri, yabancı tebliğ, özel uzatma vb. durumları gözden geçirin.
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={() => {
                if (step === 1) onClose()
                else setStep((step - 1) as 1 | 2 | 3)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50"
            >
              <ArrowLeft className="h-4 w-4" />
              {step === 1 ? 'İptal' : 'Geri'}
            </button>

            {step === 2 && (
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

            {step === 3 && (
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
