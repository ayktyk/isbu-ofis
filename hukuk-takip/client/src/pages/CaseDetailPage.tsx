import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarClock,
  CreditCard,
  Edit,
  FileText,
  ListChecks,
  Loader2,
  Plus,
  StickyNote,
  Trash2,
  User,
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
import { useCreateTask, useDeleteTask } from '@/hooks/useTasks'
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

export default function CaseDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [noteContent, setNoteContent] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [hearingDate, setHearingDate] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [collectionAmount, setCollectionAmount] = useState('')
  const [documentDescription, setDocumentDescription] = useState('')
  const [documentFiles, setDocumentFiles] = useState<File[]>([])

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
  const deleteTask = useDeleteTask()
  const createExpense = useCreateExpense()
  const deleteExpense = useDeleteExpense()
  const createCollection = useCreateCollection()
  const deleteCollection = useDeleteCollection()
  const createDocument = useCreateDocument()
  const deleteDocument = useDeleteDocument(id)
  const createNote = useCreateNote()
  const deleteNote = useDeleteNote()

  const hearings = hearingsData || []
  const tasks = tasksData || []
  const expenses = expensesData || []
  const collections = collectionsData || []
  const documents = documentsData || []
  const notes = notesData || []

  const totalExpenses = expenses.reduce((sum: number, item: any) => sum + Number.parseFloat(item.amount || '0'), 0)
  const totalCollections = collections.reduce((sum: number, item: any) => sum + Number.parseFloat(item.amount || '0'), 0)

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => navigate('/cases')}
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
            onClick={() => navigate(`/cases/${id}/edit`)}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition hover:bg-muted"
          >
            <Edit className="h-4 w-4" />
            Duzenle
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Bu davayi silmek istediginize emin misiniz?')) {
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <User className="h-5 w-5 text-law-accent" />
            <div>
              <p className="text-xs text-muted-foreground">Müvekkil</p>
              <p className="text-sm font-medium">{caseData.clientName || '-'}</p>
            </div>
          </CardContent>
        </Card>
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

      {caseData.description && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-foreground/90">{caseData.description}</CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold"><CalendarClock className="h-4 w-4 text-law-accent" />Duruşmalar</h2>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!id || !hearingDate) return
                // datetime-local değeri saat dilimi içermez; sunucu UTC'de ise
                // +3 saat kayma olmaması için local → ISO çevirisi yapılır.
                createHearing.mutate(
                  { caseId: id, hearingDate: localInputToISO(hearingDate) },
                  { onSuccess: () => setHearingDate('') }
                )
              }}
              className="flex gap-2"
            >
              <input type="datetime-local" value={hearingDate} onChange={(e) => setHearingDate(e.target.value)} className="flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20" />
              <button type="submit" disabled={createHearing.isPending || !hearingDate} className="rounded-xl bg-law-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                {createHearing.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </form>
            <p className="text-xs text-muted-foreground">Durusmalar da Google Calendar baglantisi aktif oldugunda 3 gun once hatirlatilir.</p>
            {hearings.length === 0 ? <p className="text-sm text-muted-foreground">Duruşma bulunmuyor.</p> : hearings.map((item: any) => (
              <div key={item.id} className="flex items-start justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">{formatDateTime(item.hearingDate)}</p>
                  <p className="text-xs text-muted-foreground">{hearingResultLabels[item.result] || item.result || 'Beklemede'}</p>
                </div>
                <button type="button" onClick={() => deleteHearing.mutate(item.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold"><ListChecks className="h-4 w-4 text-law-accent" />Görevler</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!id || !taskTitle.trim()) return
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
              <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Yeni gorev" className="flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20" />
              <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20" />
              <button type="submit" disabled={createTask.isPending || !taskTitle.trim()} className="rounded-xl bg-law-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </form>
            <p className="text-xs text-muted-foreground">Son tarih girilen gorevler Google Calendar baglantisi aktif oldugunda 3 gun once hatirlatilir.</p>
            {tasks.length === 0 ? <p className="text-sm text-muted-foreground">Görev bulunmuyor.</p> : tasks.map((item: any) => (
              <div key={item.id} className="flex items-start justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {taskPriorityLabels[item.priority] || item.priority} • {taskStatusLabels[item.status] || item.status}
                  </p>
                  {item.dueDate && <p className="text-xs text-muted-foreground">Son tarih: {formatDate(item.dueDate)}</p>}
                </div>
                <button type="button" onClick={() => deleteTask.mutate(item.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Banknote className="h-4 w-4 text-law-accent" />Masraflar</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!id || !expenseDescription.trim() || !expenseAmount) return
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
                <input type="text" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="Tutar" className="flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20" />
                <button type="submit" disabled={createExpense.isPending || !expenseDescription.trim() || !expenseAmount} className="rounded-xl bg-law-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{createExpense.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</button>
              </div>
            </form>
            {expenses.length === 0 ? <p className="text-sm text-muted-foreground">Masraf bulunmuyor.</p> : expenses.map((item: any) => (
              <div key={item.id} className="flex items-start justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{expenseTypeLabels[item.type] || item.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-red-600">{formatCurrency(item.amount, item.currency || caseData.currency || 'TRY')}</span>
                  <button type="button" onClick={() => deleteExpense.mutate(item.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold"><CreditCard className="h-4 w-4 text-law-accent" />Tahsilatlar</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!id || !caseData.clientId || !collectionAmount) return
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
              <input type="text" value={collectionAmount} onChange={(e) => setCollectionAmount(e.target.value)} placeholder="Tahsilat tutari" className="flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20" />
              <button type="submit" disabled={createCollection.isPending || !collectionAmount || !caseData.clientId} className="rounded-xl bg-law-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{createCollection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</button>
            </form>
            {collections.length === 0 ? <p className="text-sm text-muted-foreground">Tahsilat bulunmuyor.</p> : collections.map((item: any) => (
              <div key={item.id} className="flex items-start justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">{formatCurrency(item.amount, item.currency || caseData.currency || 'TRY')}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.collectionDate)}</p>
                </div>
                <button type="button" onClick={() => deleteCollection.mutate(item.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold"><FileText className="h-4 w-4 text-law-accent" />Belgeler</h2>
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
            {documents.length === 0 ? <p className="text-sm text-muted-foreground">Belge bulunmuyor.</p> : documents.map((item: any) => (
              <div key={item.id} className="flex items-start justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">{item.fileName}</p>
                  <p className="text-xs text-muted-foreground">{getDocumentTypeLabel(item.fileName)} • {formatFileSize(item.fileSize)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`/api/documents/${item.id}/download`} className="text-sm text-law-accent">Indir</a>
                  <button type="button" onClick={() => deleteDocument.mutate(item.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold"><StickyNote className="h-4 w-4 text-law-accent" />Notlar</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!id || !noteContent.trim()) return
                createNote.mutate({ caseId: id, content: noteContent.trim() }, { onSuccess: () => setNoteContent('') })
              }}
              className="space-y-2"
            >
              <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} rows={4} placeholder="Dosya notu" className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-law-accent focus:ring-2 focus:ring-law-accent/20" />
              <button type="submit" disabled={createNote.isPending || !noteContent.trim()} className="inline-flex items-center gap-2 rounded-xl bg-law-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{createNote.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Not Ekle</button>
            </form>
            {notes.length === 0 ? <p className="text-sm text-muted-foreground">Not bulunmuyor.</p> : notes.map((item: any) => (
              <div key={item.id} className="flex items-start justify-between rounded-xl border p-3">
                <div>
                  <p className="whitespace-pre-wrap text-sm">{item.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                </div>
                <button type="button" onClick={() => deleteNote.mutate(item.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
