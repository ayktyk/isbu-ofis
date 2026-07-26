import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { useTasks, useUpdateTaskStatus, useDeleteTask, useReorderTasks } from '@/hooks/useTasks'
import { useCases } from '@/hooks/useCases'
import { matchesQuery } from '@/lib/textSearch'
import { resolveTaskCategory, taskCategoryOptions } from '@/lib/taskCategory'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import TaskForm from '@/components/tasks/TaskForm'
import TaskRow from '@/components/tasks/TaskRow'
import { AlertTriangle, ListChecks, Plus, Search, X } from 'lucide-react'

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
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data, isLoading, isError } = useTasks({
    status: status || undefined,
    priority: priority || undefined,
    isDeadline: false,
  })

  // Normal davalar ve CMK dosyalari ayri cekilir: gorev formunda kategori
  // secimine gore dogru liste gosterilir. (Onceden yalnizca normal davalar
  // cekiliyordu — bir gorev CMK dosyasina hic baglanamiyordu.)
  const { data: casesData } = useCases({ pageSize: 100 })
  const { data: cmkData } = useCases({ isCmk: 'only', pageSize: 100 })

  const updateStatus = useUpdateTaskStatus()
  const deleteTask = useDeleteTask()
  const reorderTasks = useReorderTasks()

  const tasks = Array.isArray(data) ? data : data?.data || []
  const casesList = casesData?.data || []
  const cmkList = cmkData?.data || []

  // Arama ve kategori filtresi istemci tarafinda: liste zaten tek istekte
  // geliyor, sunucuya gitmeden aninda daraliyor.
  const filteredTasks = useMemo(
    () =>
      tasks.filter((task: any) => {
        if (category && resolveTaskCategory(task) !== category) return false
        return matchesQuery(query, [task.title, task.description, task.label, task.caseTitle])
      }),
    [tasks, query, category]
  )

  const openCount = useMemo(
    () => tasks.filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled').length,
    [tasks]
  )

  const existingTasks = useMemo(
    () => tasks.map((t: any) => ({ id: t.id, title: t.title, label: t.label })),
    [tasks]
  )

  const isFiltered = filteredTasks.length !== tasks.length
  const hasAnyFilter = Boolean(status || priority || category || query)

  // ── Sürükle-bırak sıralama ────────────────────────────────────────────────
  // Sürükleme YALNIZCA filtresiz listede açıktır. Filtreliyken sürüklemek,
  // ekranda görünmeyen görevlerin sırasını da bozardı — kullanıcı ne olduğunu
  // göremediği için bu bilinçli olarak engellendi.
  const canReorder = !hasAnyFilter && filteredTasks.length > 1

  // Sunucudan gelen sıra, sürükleme sırasında anlık olarak burada tutulur;
  // böylece kullanıcı bırakır bırakmaz liste yeni sırada kalır.
  const [orderedIds, setOrderedIds] = useState<string[]>([])

  useEffect(() => {
    setOrderedIds(tasks.map((t: any) => t.id))
    // tasks referansı her fetch'te değişir; id dizisini karşılaştırmak yeterli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.map((t: any) => t.id).join(',')])

  const displayedTasks = useMemo(() => {
    if (!canReorder || orderedIds.length === 0) return filteredTasks
    const byId = new Map(filteredTasks.map((t: any) => [t.id, t]))
    const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean)
    // Henüz orderedIds'e girmemiş yeni görevler kaybolmasın.
    const missing = filteredTasks.filter((t: any) => !orderedIds.includes(t.id))
    return [...ordered, ...missing]
  }, [filteredTasks, orderedIds, canReorder])

  const sensors = useSensors(
    // Mobilde: 200ms basılı tut, sonra sürükle. Böylece normal kaydırma
    // hareketi yanlışlıkla sürükleme başlatmaz.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    // Masaüstünde: 6px hareket eşiği — tıklamalar sürükleme sayılmaz.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = orderedIds.indexOf(String(active.id))
    const newIndex = orderedIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    const next = arrayMove(orderedIds, oldIndex, newIndex)
    setOrderedIds(next)
    reorderTasks.mutate(next)
  }

  function toggleComplete(task: any) {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    updateStatus.mutate({ id: task.id, status: newStatus })
  }

  function handleDelete(id: string) {
    if (confirm('Bu görevi silmek istediğinize emin misiniz?')) {
      deleteTask.mutate(id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Başlık + sayaç */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Görevler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tasks.length === 0
              ? 'Tüm görevlerinizi yönetin'
              : isFiltered
              ? `${filteredTasks.length} / ${tasks.length} görev gösteriliyor`
              : `${tasks.length} görev · ${openCount} tamamlanmadı`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-law-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'İptal' : 'Yeni Görev'}
        </button>
      </div>

      {/* Görev ekleme formu */}
      {showForm && (
        <TaskForm
          mode="create"
          casesList={casesList}
          cmkList={cmkList}
          existingTasks={existingTasks}
          onDone={() => setShowForm(false)}
        />
      )}

      {/* Arama + filtreler */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <div className="relative col-span-2 sm:min-w-[260px] sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Görev, açıklama, etiket, dava ara…"
            className="w-full rounded-lg border bg-background py-2.5 pl-10 pr-9 text-sm outline-none transition focus:border-law-accent focus:ring-2 focus:ring-law-accent/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Aramayı temizle"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
        >
          <option value="">Tüm Kategoriler</option>
          {taskCategoryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-law-accent"
        >
          {priorityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
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
          {displayedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ListChecks className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-muted-foreground">
                {hasAnyFilter ? 'Sonuç bulunamadı' : 'Henüz görev eklenmemiş'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                {hasAnyFilter
                  ? 'Arama veya filtreleri değiştirin'
                  : 'Yukarıdaki butona tıklayarak yeni görev ekleyin'}
              </p>
              {!hasAnyFilter && !showForm && (
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
            <>
              {canReorder && (
                <p className="-mt-2 mb-2 text-xs text-muted-foreground">
                  Soldaki tutamaktan sürükleyerek görevlerin sırasını
                  değiştirebilirsin. Telefonda tutamağa basılı tut, sonra kaydır.
                </p>
              )}
              {hasAnyFilter && filteredTasks.length > 1 && (
                <p className="-mt-2 mb-2 text-xs text-muted-foreground">
                  Sıralamayı değiştirmek için arama ve filtreleri temizle.
                </p>
              )}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={displayedTasks.map((t: any) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {displayedTasks.map((task: any) =>
                      editingId === task.id ? (
                        <TaskForm
                          key={task.id}
                          mode="edit"
                          task={task}
                          casesList={casesList}
                          cmkList={cmkList}
                          existingTasks={existingTasks}
                          onDone={() => setEditingId(null)}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <TaskRow
                          key={task.id}
                          task={task}
                          sortable={canReorder}
                          onToggleComplete={toggleComplete}
                          onEdit={setEditingId}
                          onDelete={handleDelete}
                        />
                      )
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}
        </>
      )}
    </div>
  )
}
