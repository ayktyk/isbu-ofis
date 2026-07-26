import { useNavigate } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CheckCircle2, Circle, Clock, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { formatRelativeDate, isOverdue, taskPriorityLabels, taskStatusLabels } from '@/lib/utils'
import { resolveTaskCategory, taskCategoryBadgeClass, taskCategoryLabels } from '@/lib/taskCategory'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const priorityVariant: Record<string, 'danger' | 'warning' | 'secondary' | 'outline'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'secondary',
  low: 'outline',
}

export default function TaskRow({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  sortable = false,
}: {
  task: any
  onToggleComplete: (task: any) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  /** Suruklenebilir mi? Arama/filtre aktifken kapatilir (bkz. TasksPage). */
  sortable?: boolean
}) {
  const navigate = useNavigate()
  const completed = task.status === 'completed'
  const overdue = task.dueDate && isOverdue(task.dueDate) && !completed
  // Eski gorevlerde category NULL olabilir; bagli davadan turetilir, o da
  // yoksa rozet hic gosterilmez (uydurma etiket basmayiz).
  const category = resolveTaskCategory(task)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !sortable,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Suruklenen kart ustte kalsin ve hafifce belirsizlessin.
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 20 : undefined,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`transition-colors ${completed ? 'opacity-60' : ''} ${overdue ? 'border-red-200' : ''} ${
        isDragging ? 'relative shadow-lg' : ''
      }`}
    >
      <CardContent className="flex items-start gap-3 p-4">
        {sortable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            // touch-none: mobilde surukleme sirasinda sayfanin kaymasini onler.
            className="mt-0.5 flex-shrink-0 cursor-grab touch-none text-muted-foreground/40 transition-colors hover:text-law-accent active:cursor-grabbing"
            aria-label="Sürükleyerek sırala"
            title="Sürükleyerek sırala"
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={() => onToggleComplete(task)}
          className={`mt-0.5 flex-shrink-0 transition-colors ${
            completed
              ? 'text-emerald-500 hover:text-emerald-600'
              : 'text-muted-foreground/40 hover:text-law-accent'
          }`}
          aria-label={completed ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}
        >
          {completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-medium ${completed ? 'line-through' : ''}`}>{task.title}</p>
            {category && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${taskCategoryBadgeClass[category]}`}
              >
                {taskCategoryLabels[category]}
              </span>
            )}
            <Badge
              variant={priorityVariant[task.priority] || 'outline'}
              className="px-1.5 py-0 text-[10px]"
            >
              {taskPriorityLabels[task.priority] || task.priority}
            </Badge>
            <Badge
              variant={
                task.status === 'completed'
                  ? 'success'
                  : task.status === 'in_progress'
                  ? 'default'
                  : task.status === 'cancelled'
                  ? 'secondary'
                  : 'warning'
              }
              className="px-1.5 py-0 text-[10px]"
            >
              {taskStatusLabels[task.status] || task.status}
            </Badge>
          </div>

          {task.description && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{task.description}</p>
          )}

          {task.label && (
            <span className="mt-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
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
              <span
                className={`inline-flex items-center gap-1 ${overdue ? 'font-medium text-red-600' : ''}`}
              >
                <Clock className="h-3 w-3" />
                {formatRelativeDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onEdit(task.id)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-law-accent/10 hover:text-law-accent active:bg-law-accent/20"
            aria-label="Düzenle"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-red-50 hover:text-red-600 active:bg-red-100"
            aria-label="Sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
