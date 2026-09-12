import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Calendar as CalendarIcon,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDashed,
  CreditCard,
  Edit,
  FileText,
  FilePlus2,
  Flag,
  HandCoins,
  History,
  Hourglass,
  ListChecks,
  Loader2,
  Plus,
  Sparkles,
  StickyNote,
  Trash2,
} from 'lucide-react'
import {
  useCaseDetail,
  useCreateCollection,
  useCreateDocument,
  useCreateExpense,
  useDeleteCase,
  useDeleteCollection,
  useDeleteDocument,
  useDeleteExpense,
} from '@/hooks/useCases'
import { useCreateHearing, useDeleteHearing } from '@/hooks/useHearings'
import { useCreateNote, useDeleteNote } from '@/hooks/useNotes'
import { useCreateTask, useUpdateTaskStatus } from '@/hooks/useTasks'
import { useAuth } from '@/hooks/useAuth'
import { compareDueDates, getOpenWork } from '@/lib/caseWorkspace'
import CaseWorkSummary from '@/components/cases/CaseWorkSummary'
import { NewLegalDeadlineForm } from '@/components/deadlines/NewLegalDeadlineForm'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  useCaseDiary,
  useCreateDiaryEntry,
  useDeleteDiaryEntry,
  useToggleNextStepDone,
  type DiaryEntry,
  type DiaryEntryType,
} from '@/hooks/useCaseDiary'
import {
  caseStatusLabels,
  caseTypeLabels,
  expenseTypeLabels,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFileSize,
  hearingResultLabels,
  localInputToISO,
  taskPriorityLabels,
  taskStatusLabels,
} from '@/lib/utils'
import {
  DOCUMENT_ACCEPT_ATTRIBUTE,
  DOCUMENT_UPLOAD_HELP_TEXT,
  MAX_DOCUMENT_UPLOAD_FILES,
  MAX_DOCUMENT_UPLOAD_SIZE_MB,
  getDocumentTypeLabel,
} from '@/lib/documents'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CaseEntryForm from '@/components/cases/CaseEntryForm'
import WorkflowPanel from '@/components/cases/WorkflowPanel'
import HearingReviewForm from '@/components/cases/HearingReviewForm'
import { useLocalDraft } from '@/hooks/useLocalDraft'
import { useCaseShortcuts } from '@/hooks/useCaseShortcuts'
import FeeInstallmentTable from '@/components/cases/FeeInstallmentTable'

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

const diaryEntryTypeLabels: Record<DiaryEntryType, string> = {
  manual: 'Elle',
  hearing_added: 'Duruşma',
  hearing_updated: 'Duruşma güncellendi',
  hearing_completed: 'Duruşma sonucu',
  task_added: 'Görev',
  task_completed: 'Görev tamamlandı',
  expense_added: 'Masraf',
  collection_added: 'Tahsilat',
  document_added: 'Belge',
  status_changed: 'Durum değişti',
  note_added: 'Not',
}

function diaryEntryIcon(type: DiaryEntryType) {
  switch (type) {
    case 'manual':
      return Edit
    case 'hearing_added':
    case 'hearing_updated':
    case 'hearing_completed':
      return CalendarClock
    case 'task_added':
    case 'task_completed':
      return ListChecks
    case 'expense_added':
      return CreditCard
    case 'collection_added':
      return Banknote
    case 'document_added':
      return FilePlus2
    case 'status_changed':
      return Flag
    case 'note_added':
      return StickyNote
    default:
      return Sparkles
  }
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return ''
  // GG.AA.YYYY hızlı format
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${date.getFullYear()}`
}

export default function CaseDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedSection = searchParams.get('section') || 'overview'
  const section = ['overview', 'work', 'documents', 'finance'].includes(requestedSection) ? requestedSection : 'overview'
  const [scrollTarget, setScrollTarget] = useState<string | null>(null)
  function openSection(value: string, target = 'case-section-start') {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      if (value === 'overview') next.delete('section')
      else next.set('section', value)
      return next
    }, { replace: true, state: location.state })
    setScrollTarget(target)
  }
  useEffect(() => {
    if (!scrollTarget) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(scrollTarget)?.scrollIntoView({ block: 'start', behavior: 'auto' })
      setScrollTarget(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [section, scrollTarget])
  const { user } = useAuth()
  const shortcuts = useCaseShortcuts(user?.id, id)
  const [showQuickNote, setShowQuickNote] = useState(false)
  const [showDeadlineForm, setShowDeadlineForm] = useState(false)
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)
  const updateTaskStatus = useUpdateTaskStatus()
  const [noteContent, setNoteContent] = useLocalDraft(user?.id || 'pending', `note:${id}`, '')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [hearingDate, setHearingDate] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [collectionAmount, setCollectionAmount] = useState('')
  const [documentDescription, setDocumentDescription] = useState('')
  const [documentFiles, setDocumentFiles] = useState<File[]>([])

  // Dava Günlüğü state'i
  const [diaryContent, setDiaryContent] = useState('')
  const [diaryNextStep, setDiaryNextStep] = useState('')
  const [diaryNextStepDate, setDiaryNextStepDate] = useState('')
  const [diaryOccurredAt, setDiaryOccurredAt] = useState('')
  const [diaryFilter, setDiaryFilter] = useState<'all' | 'manual' | 'auto' | 'open_next_step'>(
    'all',
  )

  // Tek roundtrip — 6 istek yerine tek endpoint detay verisini birleştirir
  const { data: detail, isLoading, isError } = useCaseDetail(id)
  const caseData = detail?.case
  const hearingsData = detail?.hearings
  const tasksData = detail?.tasks
  const expensesData = detail?.expenses
  const collectionsData = detail?.collections
  const documentsData = detail?.documents
  const notesData = detail?.notes

  const deleteCase = useDeleteCase()
  const createHearing = useCreateHearing()
  const deleteHearing = useDeleteHearing()
  const createTask = useCreateTask()
  const createExpense = useCreateExpense()
  const deleteExpense = useDeleteExpense()
  const createCollection = useCreateCollection()
  const deleteCollection = useDeleteCollection()
  const createDocument = useCreateDocument()
  const deleteDocument = useDeleteDocument(id)
  const createNote = useCreateNote()
  const deleteNote = useDeleteNote()

  const { data: diaryData, isLoading: diaryLoading, isError: diaryError } = useCaseDiary(id)
  const createDiaryEntry = useCreateDiaryEntry(id)
  const deleteDiaryEntry = useDeleteDiaryEntry(id)
  const toggleNextStepDone = useToggleNextStepDone(id)

  const hearings = hearingsData || []
  const tasks = tasksData || []
  const expenses = expensesData || []
  const collections = collectionsData || []
  const documents = documentsData || []
  const notes = notesData || []
  const readOnly = ['won', 'lost', 'settled', 'closed'].includes(caseData?.status)
  const canWrite = !readOnly && (user?.role === 'admin' || user?.role === 'lawyer')
  const canComplete = !readOnly && ['admin', 'lawyer', 'assistant'].includes(user?.role)
  const jumpTo = (target: string) => openSection(target === 'case-diary' ? 'overview' : 'work', target)
  useEffect(() => {
    const main = document.getElementById('app-scroll-main')
    if (main) main.scrollTop = 0
  }, [id])

  const totalExpenses = expenses.reduce((sum: number, item: any) => sum + Number.parseFloat(item.amount || '0'), 0)
  const totalCollections = collections.reduce((sum: number, item: any) => sum + Number.parseFloat(item.amount || '0'), 0)

  // Bekleyen ücret görünürlüğü — server "financials" dönerse onu, yoksa client-side
  // fallback hesabı kullan. contractedFee 0/boşsa "bekleyen" gösterilmez.
  const contractedFee = detail?.financials?.contractedFee ?? Number.parseFloat(caseData?.contractedFee || '0')
  const pendingFee = contractedFee > 0 ? Math.max(0, contractedFee - totalCollections) : 0

  // Ücret anlaşması özeti. Yalnızca yüzdelik anlaşmalarda hesaplanabilir bir
  // tutar YOKTUR — rakam uydurmayız, oranı ve matrahı yazarız.
  const feeType = caseData?.feeType || (contractedFee > 0 ? 'fixed' : null)
  const feePercentage = caseData?.feePercentage
  const feeBaseLabel =
    caseData?.feePercentageBase === 'awarded' ? 'hükmedilen' : 'tahsil edilen'

  const feeSummary = (() => {
    const fixedPart =
      contractedFee > 0 ? formatCurrency(contractedFee, caseData?.currency || 'TRY') : null
    const percentPart = feePercentage ? `%${feePercentage} · ${feeBaseLabel}` : null

    if (feeType === 'percentage') return percentPart || '—'
    if (feeType === 'fixed_plus_percentage') {
      return [fixedPart, percentPart].filter(Boolean).join(' + ') || '—'
    }
    return fixedPart || '—'
  })()

  const diaryEntries: DiaryEntry[] = diaryData || []
  const diarySteps = getOpenWork([], diaryEntries)
  const filteredDiary = diaryEntries.filter((entry) => {
    if (diaryFilter === 'all') return true
    if (diaryFilter === 'manual') return entry.entryType === 'manual'
    if (diaryFilter === 'auto') return entry.entryType !== 'manual'
    if (diaryFilter === 'open_next_step') return !!entry.nextStep && !entry.nextStepDone
    return true
  })

  function appendSelectedFiles(fileList: FileList | null) {
    if (!fileList) return
    setDocumentFiles(Array.from(fileList).slice(0, MAX_DOCUMENT_UPLOAD_FILES))
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (isError || !caseData) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-center gap-3 p-6">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">Dava bulunamadi.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <button
            type="button"
            aria-label="Dava listesine dön"
            onClick={() => {
              const url = location.state?.caseListUrl
              navigate(typeof url === 'string' && (url === '/cases' || url.startsWith('/cases?')) ? url : '/cases')
            }}
            className="mt-1 rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="page-title">{caseData.title}</h1>
              <Badge variant={statusVariant[caseData.status] || 'secondary'}>
                {caseStatusLabels[caseData.status] || caseData.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {caseTypeLabels[caseData.caseType] || caseData.caseType}
              {caseData.caseNumber ? ` • Esas: ${caseData.caseNumber}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canWrite} onClick={() => navigate(`/cases/${id}/edit`)}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition hover:bg-muted"
          >
            <Edit className="h-4 w-4" />
            Duzenle
          </button>
          <button
            type="button"
            disabled={!canWrite}
            onClick={() => {
              if (canWrite && confirm('Bu davayi silmek istediginize emin misiniz?')) {
                deleteCase.mutate(caseData.id, { onSuccess: () => navigate('/cases') })
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Sil
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{caseData.clientName || 'Müvekkil belirtilmemiş'} · {caseData.courtName || 'Mahkeme belirtilmemiş'} · Başlangıç: {formatDate(caseData.startDate)}</p>
      {readOnly && <p className="rounded-xl border bg-muted p-3 text-sm">Bu dava sonuçlandığı için yalnızca görüntülenebilir.</p>}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Tahsilat: {formatCurrency(totalCollections, caseData.currency || 'TRY')}</span>
        <span>Masraf: {formatCurrency(totalExpenses, caseData.currency || 'TRY')}</span>
        <span>Fark (tahsilat − masraf): {formatCurrency(totalCollections - totalExpenses, caseData.currency || 'TRY')}</span>
      </p>
      <Tabs id="case-section-start" value={section} onValueChange={value => openSection(value)} className="space-y-4">
      <div id="case-sections" className="sticky top-0 z-20 space-y-2 rounded-xl border bg-background/95 p-2 shadow-sm">
        <TabsList aria-label="Dava bölümleri" className="grid h-auto w-full grid-cols-4">
          <TabsTrigger className="min-h-11 px-2" value="overview">Özet</TabsTrigger>
          <TabsTrigger className="min-h-11 px-2" value="work">İşler</TabsTrigger>
          <TabsTrigger className="min-h-11 px-2" value="documents">Belgeler</TabsTrigger>
          <TabsTrigger className="min-h-11 px-2" value="finance">Mali</TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap gap-2">
        {canWrite && <button type="button" onClick={() => setShowQuickNote(true)} className="min-h-11 rounded-lg bg-law-accent px-4 text-sm font-medium text-white">Not ekle</button>}
        <button type="button" onClick={() => jumpTo('case-diary')} className="min-h-11 rounded-lg border px-3 text-sm">Günlük</button>
        {canWrite && <button type="button" onClick={() => setShowDeadlineForm(true)} className="min-h-11 rounded-lg border px-3 text-sm">Süreli iş ekle</button>}
        </div>
      </div>

      {showDeadlineForm && <NewLegalDeadlineForm defaultCaseId={id} defaultCase={caseData} onClose={() => setShowDeadlineForm(false)} />}
      <Dialog open={showQuickNote} onOpenChange={setShowQuickNote}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-xl">
          <DialogTitle>Dosyaya not ekle</DialogTitle>
          <DialogDescription>{caseData.title}</DialogDescription>
          <form className="space-y-3" onSubmit={event => {
            event.preventDefault()
            if (!canWrite || !id || !noteContent.trim() || createNote.isPending) return
            createNote.mutate({ caseId: id, content: noteContent.trim() }, { onSuccess: () => { setNoteContent(''); setShowQuickNote(false) } })
          }}>
            <label htmlFor="quick-case-note" className="text-sm font-medium">Notunuz</label>
            <textarea id="quick-case-note" disabled={createNote.isPending} value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={5} className="w-full rounded-xl border bg-background p-3 text-base" placeholder="Dosyada ne oldu, ne bekleniyor?" />
            <p className="text-xs text-muted-foreground">Kaydedilmemiş notunuz bu cihazda taslak olarak korunur.</p>
            <button type="submit" disabled={!noteContent.trim() || createNote.isPending || !canWrite} className="min-h-11 w-full rounded-xl bg-law-accent px-4 text-sm font-medium text-white disabled:opacity-50">{createNote.isPending ? 'Kaydediliyor…' : 'Notu kaydet'}</button>
          </form>
        </DialogContent>
      </Dialog>
      <TabsContent forceMount value="overview" className="space-y-4 data-[state=inactive]:hidden">
      {id && user?.id && <><button className="min-h-11 rounded-xl border px-4 text-sm" aria-pressed={shortcuts.pinned.includes(id)} onClick={() => shortcuts.toggle(id)}>{shortcuts.pinned.includes(id) ? '★ Sabitlendi · Kaldır' : '☆ Dosyayı sabitle'}</button><WorkflowPanel caseId={id} userId={user.id} canWrite={canWrite} /></>}
      <CaseWorkSummary tasks={tasks} diary={diaryEntries} hearings={hearings} notes={notes} diaryLoading={diaryLoading} diaryError={diaryError} onWork={target => jumpTo(target || 'case-tasks')} onDiary={() => jumpTo('case-diary')} />
      {caseData.description && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-foreground/90">{caseData.description}</CardContent>
        </Card>
      )}
      {/* ─── Dava Günlüğü — kronolojik aktivite + sonraki adım ───────────── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h2 id="case-diary" className="scroll-mt-36 flex items-center gap-2 text-base font-semibold">
              <History className="h-4 w-4 text-law-accent" />
              Dava Günlüğü
            </h2>
            <span className="text-xs text-muted-foreground">
              {diaryEntries.length} girdi
            </span>
          </div>

          {/* Manuel giriş formu */}
          <CaseEntryForm label="Gelişme ve sonraki adım ekle" canWrite={canWrite}>
            <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!canWrite || !id || !diaryContent.trim()) return
              createDiaryEntry.mutate(
                {
                  content: diaryContent.trim(),
                  nextStep: diaryNextStep.trim() || '',
                  nextStepDueDate: diaryNextStepDate || '',
                  occurredAt: diaryOccurredAt ? localInputToISO(diaryOccurredAt) : '',
                },
                {
                  onSuccess: () => {
                    setDiaryContent('')
                    setDiaryNextStep('')
                    setDiaryNextStepDate('')
                    setDiaryOccurredAt('')
                  },
                },
              )
            }}
            className="space-y-2 rounded-xl border bg-muted/30 p-3"
          >
            <textarea
              value={diaryContent}
              onChange={(e) => setDiaryContent(e.target.value)}
              rows={2}
              placeholder="Ne yapıldı? (örn. Bugün duruşmaya gittim, bilirkişi raporu okundu...)"
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <textarea
                value={diaryNextStep}
                onChange={(e) => setDiaryNextStep(e.target.value)}
                rows={2}
                placeholder="Sonraki adım (opsiyonel) — bundan sonra ne yapılacak?"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Sonraki adım tarihi
                  </label>
                  <input
                    type="date"
                    value={diaryNextStepDate}
                    onChange={(e) => setDiaryNextStepDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Olay tarihi
                  </label>
                  <input
                    type="datetime-local"
                    value={diaryOccurredAt}
                    onChange={(e) => setDiaryOccurredAt(e.target.value)}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                Olay tarihi boş bırakılırsa şimdi kabul edilir.
              </p>
              <button
                type="submit"
                disabled={createDiaryEntry.isPending || !diaryContent.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-law-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {createDiaryEntry.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Plus className="h-4 w-4" />
                Günlüğe Ekle
              </button>
            </div>
          </form>
            </CaseEntryForm>

          {/* Filtre pill'leri */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: 'all', label: 'Tümü' },
              { key: 'manual', label: 'Elle' },
              { key: 'auto', label: 'Otomatik' },
              { key: 'open_next_step', label: 'Açık Sonraki Adım' },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setDiaryFilter(opt.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  diaryFilter === opt.key
                    ? 'bg-law-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Timeline */}
          {filteredDiary.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {diaryEntries.length === 0
                ? 'Henüz günlük girdisi yok. İlk girdiyi ekleyerek başla.'
                : 'Bu filtreyle eşleşen girdi yok.'}
            </p>
          ) : (
            <ol className="space-y-2">
              {filteredDiary.map((entry) => {
                const Icon = diaryEntryIcon(entry.entryType)
                const isManual = entry.entryType === 'manual'
                return (
                  <li
                    key={entry.id}
                    className="flex gap-3 rounded-xl border bg-card p-3"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-law-accent/10 text-law-accent">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-law-accent">
                          {diaryEntryTypeLabels[entry.entryType] || entry.entryType}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(entry.occurredAt)}
                        </span>
                      </div>
                      {entry.title ? (
                        <p className="text-sm font-medium">{entry.title}</p>
                      ) : null}
                      {entry.content ? (
                        <p className="whitespace-pre-wrap text-sm text-foreground/80">
                          {entry.content}
                        </p>
                      ) : null}
                      {entry.nextStep ? (
                        <div
                          className={`mt-1 flex items-start gap-2 rounded-lg border px-3 py-2 ${
                            entry.nextStepDone
                              ? 'border-emerald-200 bg-emerald-50/50'
                              : 'border-amber-200 bg-amber-50/60'
                          }`}
                        >
                          <Flag
                            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                              entry.nextStepDone ? 'text-emerald-600' : 'text-amber-600'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-xs font-semibold uppercase tracking-wider ${
                                entry.nextStepDone ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              Sonraki adım
                              {entry.nextStepDone ? ' • Tamamlandı' : ''}
                            </p>
                            <p
                              className={`mt-0.5 whitespace-pre-wrap text-sm ${
                                entry.nextStepDone
                                  ? 'text-muted-foreground line-through'
                                  : 'text-foreground'
                              }`}
                            >
                              {entry.nextStep}
                            </p>
                            {entry.nextStepDueDate ? (
                              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-700">
                                <CalendarIcon className="h-3 w-3" />
                                {formatDateOnly(entry.nextStepDueDate)}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              toggleNextStepDone.mutate({
                                entryId: entry.id,
                                done: !entry.nextStepDone,
                              })
                            }
                            disabled={!canWrite || toggleNextStepDone.isPending}
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
                              entry.nextStepDone
                                ? 'bg-muted text-muted-foreground hover:bg-muted/70'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                          >
                            {entry.nextStepDone ? (
                              <>
                                <CircleDashed className="h-3 w-3" />
                                Geri al
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                Tamamlandı
                              </>
                            )}
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {isManual ? (
                      <button
                        type="button"
                        onClick={() => deleteDiaryEntry.mutate(entry.id)}
                        disabled={!canWrite || deleteDiaryEntry.isPending}
                        className="self-start rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        title="Girdiyi arşivle"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold"><StickyNote className="h-4 w-4 text-law-accent" />Notlar</h2>
            {canWrite && <button type="button" onClick={() => setShowQuickNote(true)} className="min-h-11 rounded-xl border px-4 text-sm font-medium text-law-accent">Not ekle</button>}
            {notes.length === 0 ? <p className="text-sm text-muted-foreground">Not bulunmuyor.</p> : notes.map((item: any) => (
              <div key={item.id} className="flex items-start justify-between rounded-xl border p-3">
                <div>
                  <p className="whitespace-pre-wrap text-sm">{item.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                </div>
                <button type="button" disabled={!canWrite} onClick={() => deleteNote.mutate(item.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>


      </TabsContent>
      <TabsContent forceMount value="work" className="space-y-4 data-[state=inactive]:hidden">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold">Günlükteki açık adımlar</h2>
            {diaryLoading ? <p className="text-sm text-muted-foreground">Yükleniyor…</p> : diaryError ? <p className="text-sm text-amber-700">Günlük adımları alınamadı.</p> : diarySteps.length === 0 ? <p className="text-sm text-muted-foreground">Açık günlük adımı yok.</p> : diarySteps.map(step => (
              <div id={`case-diary-${step.id}`} key={step.id} className="scroll-mt-36 flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.dueDate ? formatDateOnly(step.dueDate) : 'Tarih belirtilmemiş'}</p>
                </div>
                {canWrite && <button type="button" disabled={toggleNextStepDone.isPending} onClick={() => toggleNextStepDone.mutate({ entryId: step.id, done: true })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium text-law-accent"><Check className="h-4 w-4" />Tamamla</button>}
              </div>
            ))}
            <button type="button" onClick={() => jumpTo('case-diary')} className="min-h-11 text-sm font-medium text-law-accent">Günlüğü aç / tamamlanan adımı geri al →</button>
          </CardContent>
        </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold"><CalendarClock className="h-4 w-4 text-law-accent" />Duruşmalar</h2>
            </div>
            <CaseEntryForm label="Duruşma ekle" canWrite={canWrite}>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!canWrite || !id || !hearingDate) return
                // datetime-local değeri saat dilimi içermez; sunucu UTC'de ise
                // +3 saat kayma olmaması için local → ISO çevirisi yapılır.
                createHearing.mutate(
                  { caseId: id, hearingDate: localInputToISO(hearingDate) },
                  { onSuccess: () => setHearingDate('') }
                )
              }}
              className="flex gap-2"
            >
              <input type="datetime-local" value={hearingDate} onChange={(e) => setHearingDate(e.target.value)} className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20" />
              <button type="submit" disabled={createHearing.isPending || !hearingDate} className="rounded-xl bg-law-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                {createHearing.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </form>
            </CaseEntryForm>
            <p className="text-xs text-muted-foreground">Durusmalar da Google Calendar baglantisi aktif oldugunda 3 gun once hatirlatilir.</p>
            {hearings.length === 0 ? <p className="text-sm text-muted-foreground">Duruşma bulunmuyor.</p> : hearings.map((item: any) => (
              <div key={item.id} className="flex items-start justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">{formatDateTime(item.hearingDate)}</p>
                  <p className="text-xs text-muted-foreground">{hearingResultLabels[item.result] || item.result || 'Beklemede'}</p>
                  {canWrite && item.result === 'pending' && user?.id && <HearingReviewForm hearingId={item.id} userId={user.id} />}
                </div>
                <button type="button" disabled={!canWrite} onClick={() => deleteHearing.mutate(item.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h2 id="case-tasks" className="scroll-mt-36 flex items-center gap-2 text-base font-semibold"><ListChecks className="h-4 w-4 text-law-accent" />Görevler</h2>
            <CaseEntryForm label="Görev ekle" canWrite={canWrite}>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!canWrite || !id || !taskTitle.trim()) return
                // Sadece tarih girilen görevler için default saat 09:00 (local) olarak
                // gönderilir, TZ offset korunur; sunucu UTC'de ise +3 kayması olmaz.
                const dueDateIso = taskDueDate
                  ? localInputToISO(`${taskDueDate}T09:00`)
                  : undefined
                createTask.mutate(
                  {
                    caseId: id,
                    title: taskTitle.trim(),
                    priority: 'medium',
                    dueDate: dueDateIso,
                  },
                  {
                    onSuccess: () => {
                      setTaskTitle('')
                      setTaskDueDate('')
                    },
                  }
                )
              }}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
            >
              <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Yeni gorev" className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20" />
              <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20" />
              <button type="submit" disabled={createTask.isPending || !taskTitle.trim()} className="rounded-xl bg-law-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </form>
            </CaseEntryForm>
            <p className="text-xs text-muted-foreground">Son tarih girilen gorevler Google Calendar baglantisi aktif oldugunda 3 gun once hatirlatilir.</p>
            {(() => {
              const normalTasks = tasks.filter((t: any) => !t.isDeadline && (showCompletedTasks || t.status === 'pending' || t.status === 'in_progress')).sort(compareDueDates)
              if (normalTasks.length === 0)
                return <p className="text-sm text-muted-foreground">Görev bulunmuyor.</p>
              return normalTasks.map((item: any) => (
                <div id={`case-task-${item.id}`} key={item.id} className="scroll-mt-36 flex items-start justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {taskPriorityLabels[item.priority] || item.priority} • {taskStatusLabels[item.status] || item.status}
                    </p>
                    {item.dueDate && <p className="text-xs text-muted-foreground">Son tarih: {formatDate(item.dueDate)}</p>}
                  </div>
                  {canComplete && item.status !== 'cancelled' && <button type="button" disabled={updateTaskStatus.isPending} onClick={() => updateTaskStatus.mutate({ id: item.id, status: item.status === 'completed' ? 'pending' : 'completed' })} className="min-h-11 shrink-0 rounded-lg border px-3 text-xs font-medium text-law-accent disabled:opacity-50">{item.status === 'completed' ? 'Geri al' : 'Tamamla'}</button>}
                </div>
              ))
            })()}
            <button type="button" aria-expanded={showCompletedTasks} onClick={() => setShowCompletedTasks(value => !value)} className="min-h-11 text-sm font-medium text-muted-foreground">{showCompletedTasks ? 'Tamamlananları ve iptalleri gizle' : `Tamamlananlar ve iptaller (${tasks.filter((t: any) => !t.isDeadline && ['completed', 'cancelled'].includes(t.status)).length})`}</button>
          </CardContent>
        </Card>

        {/* Bu davayla ilişkili SÜRELİ İŞLER (is_deadline=true) — kritik tarihler */}
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-700">
                  !
                </span>
                Süreli İşler
              </h2>
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => setShowDeadlineForm(true)}
                className="text-xs font-medium text-red-700 hover:underline"
              >
                Yeni süreli iş ekle →
              </button>
            </div>
            {(() => {
              const deadlineTasks = tasks.filter((t: any) => t.isDeadline).sort(compareDueDates)
              if (deadlineTasks.length === 0)
                return (
                  <p className="text-sm text-muted-foreground">
                    Bu dava için süreli iş eklenmedi. İtiraz, istinaf, temyiz vb. süreleri Süreli İşler sayfasından ekleyebilirsiniz.
                  </p>
                )
              return deadlineTasks.map((item: any) => {
                const due = item.dueDate ? new Date(item.dueDate) : null
                const today = new Date()
                const dleft = due
                  ? Math.round(
                      (new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() -
                        new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
                        (24 * 60 * 60 * 1000)
                    )
                  : null
                const critical = dleft !== null && dleft <= 3 && ['pending', 'in_progress'].includes(item.status)
                return (
                  <div
                    id={`case-deadline-${item.id}`}
                    key={item.id}
                    className={`scroll-mt-36 flex items-start justify-between gap-3 rounded-xl border p-3 ${
                      critical ? 'border-red-500 bg-red-50/40' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${item.status === 'completed' ? 'line-through' : ''}`}>
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.legalBasis ? `${item.legalBasis} · ` : ''}
                        {taskStatusLabels[item.status] || item.status}
                      </p>
                      {due && (
                        <p className={`mt-0.5 text-xs ${critical ? 'font-semibold text-red-700' : 'text-muted-foreground'}`}>
                          Son gün: {formatDate(due)}
                          {dleft !== null
                            ? dleft < 0
                              ? ` (${Math.abs(dleft)} gün geçti)`
                              : dleft === 0
                                ? ' (BUGÜN)'
                                : ` (${dleft} gün kaldı)`
                            : ''}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })
            })()}
          </CardContent>
        </Card>

      </div>

      </TabsContent>
      <TabsContent forceMount value="documents" className="space-y-4 data-[state=inactive]:hidden">
      <div className="space-y-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold"><FileText className="h-4 w-4 text-law-accent" />Belgeler</h2>
            <CaseEntryForm label="Belge yükle" canWrite={canWrite}>
            <div className="rounded-xl border border-dashed p-3">
              <p className="text-xs text-muted-foreground">
                {DOCUMENT_UPLOAD_HELP_TEXT} En fazla {MAX_DOCUMENT_UPLOAD_FILES} dosya, belge basina {MAX_DOCUMENT_UPLOAD_SIZE_MB} MB.
              </p>
              <input type="file" multiple accept={DOCUMENT_ACCEPT_ATTRIBUTE} onChange={(e) => appendSelectedFiles(e.target.files)} className="mt-3 block w-full text-sm" />
            </div>
            <input type="text" value={documentDescription} onChange={(e) => setDocumentDescription(e.target.value)} placeholder="Belge aciklamasi" className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20" />
            <button
              type="button"
              disabled={createDocument.isPending || !id || documentFiles.length === 0}
              onClick={() => createDocument.mutate({ caseId: id || '', files: documentFiles, description: documentDescription.trim() }, { onSuccess: () => { setDocumentFiles([]); setDocumentDescription('') } })}
              className="inline-flex items-center gap-2 rounded-xl bg-law-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {createDocument.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Belge Yukle
            </button>
            </CaseEntryForm>
            {documents.length === 0 ? <p className="text-sm text-muted-foreground">Belge bulunmuyor.</p> : documents.map((item: any) => (
              <div key={item.id} className="flex items-start justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">{item.fileName}</p>
                  <p className="text-xs text-muted-foreground">{getDocumentTypeLabel(item.fileName)} • {formatFileSize(item.fileSize)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`/api/documents/${item.id}/download`} className="text-sm text-law-accent">Indir</a>
                  <button type="button" disabled={!canWrite} onClick={() => deleteDocument.mutate(item.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

      </div>

      </TabsContent>
      <TabsContent forceMount value="finance" className="space-y-4 data-[state=inactive]:hidden">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <CalendarClock className="h-5 w-5 text-law-accent" />
            <div>
              <p className="text-xs text-muted-foreground">Baslangic</p>
              <p className="text-sm font-medium">{formatDate(caseData.startDate)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <HandCoins className="h-5 w-5 text-law-accent" />
            <div>
              <p className="text-xs text-muted-foreground">Anlaşılan Ücret</p>
              <p className="text-sm font-medium text-law-primary">
                {feeSummary}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <Banknote className="h-5 w-5 text-law-accent" />
            <div>
              <p className="text-xs text-muted-foreground">Tahsilat</p>
              <p className="text-sm font-medium text-emerald-600">
                {formatCurrency(totalCollections, caseData.currency || 'TRY')}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <Hourglass className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-xs text-muted-foreground">Bekleyen Ücret</p>
              <p className="text-sm font-medium text-amber-600">
                {contractedFee > 0
                  ? formatCurrency(pendingFee, caseData.currency || 'TRY')
                  : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <CreditCard className="h-5 w-5 text-law-accent" />
            <div>
              <p className="text-xs text-muted-foreground">Masraf</p>
              <p className="text-sm font-medium text-red-600">
                {formatCurrency(totalExpenses, caseData.currency || 'TRY')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Banknote className="h-4 w-4 text-law-accent" />Masraflar</h2>
            <CaseEntryForm label="Masraf ekle" canWrite={canWrite}>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!canWrite || !id || !expenseDescription.trim() || !expenseAmount) return
                createExpense.mutate({
                  caseId: id,
                  type: 'other',
                  description: expenseDescription.trim(),
                  amount: expenseAmount,
                  currency: caseData.currency || 'TRY',
                  expenseDate: new Date().toISOString().split('T')[0],
                  isBillable: true,
                }, { onSuccess: () => { setExpenseDescription(''); setExpenseAmount('') } })
              }}
              className="grid gap-2"
            >
              <input type="text" value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} placeholder="Masraf aciklamasi" className="rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20" />
              <div className="flex gap-2">
                <input type="text" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="Tutar" className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20" />
                <button type="submit" disabled={createExpense.isPending || !expenseDescription.trim() || !expenseAmount} className="rounded-xl bg-law-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{createExpense.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</button>
              </div>
            </form>
            </CaseEntryForm>
            {expenses.length === 0 ? <p className="text-sm text-muted-foreground">Masraf bulunmuyor.</p> : expenses.map((item: any) => (
              <div key={item.id} className="flex items-start justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{expenseTypeLabels[item.type] || item.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-red-600">{formatCurrency(item.amount, item.currency || caseData.currency || 'TRY')}</span>
                  <button type="button" disabled={!canWrite} onClick={() => deleteExpense.mutate(item.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Ödeme planı — yalnızca taksiti olan davalarda görünür */}
        {id && <FeeInstallmentTable caseId={id} readOnly={!canWrite} />}

        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold"><CreditCard className="h-4 w-4 text-law-accent" />Tahsilatlar</h2>
            <CaseEntryForm label="Tahsilat ekle" canWrite={canWrite}>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!canWrite || !id || !caseData.clientId || !collectionAmount) return
                createCollection.mutate({
                  caseId: id,
                  clientId: caseData.clientId,
                  amount: collectionAmount,
                  currency: caseData.currency || 'TRY',
                  collectionDate: new Date().toISOString().split('T')[0],
                }, { onSuccess: () => setCollectionAmount('') })
              }}
              className="flex gap-2"
            >
              <input type="text" value={collectionAmount} onChange={(e) => setCollectionAmount(e.target.value)} placeholder="Tahsilat tutari" className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20" />
              <button type="submit" disabled={createCollection.isPending || !collectionAmount || !caseData.clientId} className="rounded-xl bg-law-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{createCollection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</button>
            </form>
            </CaseEntryForm>
            {collections.length === 0 ? <p className="text-sm text-muted-foreground">Tahsilat bulunmuyor.</p> : collections.map((item: any) => (
              <div key={item.id} className="flex items-start justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">{formatCurrency(item.amount, item.currency || caseData.currency || 'TRY')}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.collectionDate)}</p>
                </div>
                <button type="button" disabled={!canWrite} onClick={() => deleteCollection.mutate(item.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>


      </TabsContent>
      </Tabs>
    </div>
  )
}
