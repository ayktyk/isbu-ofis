import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createTaskSchema, taskPriorityValues, type CreateTaskInput } from '@hukuk-takip/shared'
import { useTasks, useCreateTask, useUpdateTaskStatus, useDeleteTask } from '@/hooks/useTasks'
import { useCases } from '@/hooks/useCases'
import {
  formatRelativeDate,
  isOverdue,
  taskPriorityLabels,
  taskStatusLabels,
} from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ListChecks,
  Clock,
  CheckCircle2,
  Circle,
  Trash2,
  AlertTriangle,
  Plus,
  X,
  Loader2,
  Save,
} from 'lucide-react'

const priorityVariant: Record<string, 'danger' | 'warning' | 'secondary' | 'outline'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'secondary',
  low: 'outline',
}

const statusOptions = [
  { value: '', label: 'Tüm Durumlar' },
  { value: 'pending', label: 'Beklemede' },
  { value: 'in_progress', label: 'Devam Ediyor' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'cancelled', label: 'İptal Edildi' },
]

const priorityOptions = [
  { value: '', label: 'Tüm Öncelikler' },
  { value: 'urgent', label: 'Acil' },
  { value: 'high', label: 'Yüksek' },
  { value: 'medium', label: 'Orta' },
  { value: 'low', label: 'Düşük' },
]

export default function TasksPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading, isError } = useTasks({
    status: status || undefined,
    priority: priority || undefined,
  })
  const { data: casesData } = useCases({ pageSize: 100 })

  const createTask = useCreateTask()
  const updateStatus = useUpdateTaskStatus()
  const deleteTask = useDeleteTask()

  const tasks = Array.isArray(data) ? data : data?.data || []
  const casesList = casesData?.data || []

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      caseId: '',
      dueDate: '',
    },
  })

  function onSubmit(formData: CreateTaskInput) {
    createTask.mutate(formData, {
      onSuccess: () => {
        reset()
        setShowForm(false)
      },
    })
  }

  function toggleComplete(task: any) {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    updateStatus.mutate({ id: task.id, status: newStatus })
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Görevler</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tüm görevlerinizi yönetin</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-law-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'İptal' : 'Yeni Görev'}
        </button>
      </div>

      {/* Görev Ekleme Formu */}
      {showForm && (
        <Card className="border-law-accent/30 bg-law-accent/5">
          <CardContent className="p-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Görev Başlığı <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('title')}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                  placeholder="Görev başlığını girin..."
                  autoFocus
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">İlgili Dava</label>
                  <select
                    {...register('caseId')}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  >
                    <option value="">Dava seçilmedi</option>
                    {casesList.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Öncelik</label>
                  <select
                    {...register('priority')}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  >
                    {taskPriorityValues.map((p) => (
                      <option key={p} value={p}>{taskPriorityLabels[p]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Son Tarih</label>
                  <input
                    {...register('dueDate')}
                    type="date"
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Açıklama</label>
                <textarea
                  {...register('description')}
                  rows={2}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-law-accent focus:ring-2 focus:ring-law-accent/20 resize-none"
                  placeholder="Görev detayları..."
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Kategori / Etiket</label>
                <input
                  {...register('label' as any)}
                  list="task-labels"
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
                  placeholder="Arabuluculuk, Baro Aidatı..."
                />
                <datalist id="task-labels">
                  {Array.from(new Set(tasks.filter((t: any) => t.label).map((t: any) => t.label))).map((l: any) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={createTask.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-law-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {createTask.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Görev Ekle
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filtreler */}
      <div className="flex gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
        >
          {priorityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">Görev listesi yüklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && (
        <>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ListChecks className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-muted-foreground">
                {status || priority ? 'Sonuç bulunamadı' : 'Henüz görev eklenmemiş'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                {status || priority ? 'Filtreleri değiştirin' : 'Yukarıdaki butona tıklayarak yeni görev ekleyin'}
              </p>
              {!status && !priority && !showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-law-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Görev Ekle
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task: any) => {
                const overdue = task.dueDate && isOverdue(task.dueDate) && task.status !== 'completed'
                const completed = task.status === 'completed'
                return (
                  <Card
                    key={task.id}
                    className={`transition-colors ${completed ? 'opacity-60' : ''} ${overdue ? 'border-red-200' : ''}`}
                  >
                    <CardContent className="flex items-start gap-3 p-4">
                      <button
                        onClick={() => toggleComplete(task)}
                        className={`mt-0.5 flex-shrink-0 transition-colors ${
                          completed
                            ? 'text-emerald-500 hover:text-emerald-600'
                            : 'text-muted-foreground/40 hover:text-law-accent'
                        }`}
                      >
                        {completed ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`font-medium ${completed ? 'line-through' : ''}`}>
                            {task.title}
                          </p>
                          <Badge
                            variant={priorityVariant[task.priority] || 'outline'}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {taskPriorityLabels[task.priority] || task.priority}
                          </Badge>
                          <Badge
                            variant={
                              task.status === 'completed' ? 'success' :
                              task.status === 'in_progress' ? 'default' :
                              task.status === 'cancelled' ? 'secondary' : 'warning'
                            }
                            className="text-[10px] px-1.5 py-0"
                          >
                            {taskStatusLabels[task.status] || task.status}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {task.description}
                          </p>
                        )}
                        {task.label && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {task.label}
                          </span>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {task.caseTitle && (
                            <button
                              onClick={() => navigate(`/cases/${task.caseId}`)}
                              className="hover:text-law-accent hover:underline"
                            >
                              {task.caseTitle}
                            </button>
                          )}
                          {task.dueDate && (
                            <span className={`inline-flex items-center gap-1 ${overdue ? 'font-medium text-red-600' : ''}`}>
                              <Clock className="h-3 w-3" />
                              {formatRelativeDate(task.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (confirm('Bu görevi silmek istediğinize emin misiniz?')) {
                            deleteTask.mutate(task.id)
                          }
                        }}
                        className="flex-shrink-0 rounded p-1.5 text-muted-foreground/40 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
