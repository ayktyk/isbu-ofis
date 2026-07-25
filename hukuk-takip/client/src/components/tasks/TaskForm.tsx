import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createTaskSchema,
  updateTaskSchema,
  taskPriorityValues,
  taskStatusValues,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@hukuk-takip/shared'
import { AlertTriangle, Loader2, Plus, Save } from 'lucide-react'
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks'
import { taskPriorityLabels, taskStatusLabels } from '@/lib/utils'
import { taskCategoryOptions } from '@/lib/taskCategory'
import { findDuplicateTitle } from '@/lib/textSearch'
import { Card, CardContent } from '@/components/ui/card'
import QuickAddCaseDialog from '@/components/shared/QuickAddCaseDialog'

type TaskFormValues = CreateTaskInput & Pick<UpdateTaskInput, 'status'>

/**
 * Gorev ekleme ve duzenleme formu — TEK kaynak.
 *
 * Onceden TasksPage icinde iki ayri kopya vardi (ekleme formu + EditTaskForm);
 * yeni bir alan eklerken iki yeri birden guncellemek gerekiyordu ve bu hata
 * kaynagiydi. Artik mode ile ayrisiyor: 'edit' modunda ek olarak Durum alani
 * gorunur.
 */
export default function TaskForm({
  mode,
  task,
  casesList,
  cmkList,
  existingTasks,
  onDone,
  onCancel,
}: {
  mode: 'create' | 'edit'
  task?: any
  casesList: any[]
  cmkList: any[]
  existingTasks: Array<{ id: string; title: string }>
  onDone: () => void
  onCancel?: () => void
}) {
  const isEdit = mode === 'edit'
  const createTask = useCreateTask()
  const updateTask = useUpdateTask(task?.id || '')
  const [caseDialogOpen, setCaseDialogOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(isEdit ? updateTaskSchema : createTaskSchema),
    defaultValues: {
      title: task?.title || '',
      description: task?.description || '',
      priority: task?.priority || 'medium',
      status: task?.status || 'pending',
      caseId: task?.caseId || '',
      category: task?.category || (task?.caseId ? (task?.caseIsCmk ? 'cmk' : 'dava') : 'genel'),
      dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      label: task?.label || '',
    },
  })

  const selectedCategory = watch('category')
  const watchedTitle = watch('title') || ''
  const showCaseSelect = selectedCategory === 'dava' || selectedCategory === 'cmk'
  const isCmkCategory = selectedCategory === 'cmk'

  // Ayni baslikta gorev zaten varsa uyarilir — ENGELLENMEZ. Avukat bilerek
  // benzer gorev ekleyebilir; amac yanlislikla iki kez yazmayi onlemek.
  const duplicate = findDuplicateTitle(watchedTitle, existingTasks, isEdit ? task?.id : undefined)

  const isPending = isEdit ? updateTask.isPending : createTask.isPending

  function onSubmit(values: TaskFormValues) {
    // Kategori dava/cmk degilse kayit baglantisi tutulmaz — 'arabuluculuk' ve
    // 'genel' yalnizca etikettir.
    const payload = showCaseSelect ? values : { ...values, caseId: '' }

    if (isEdit) {
      updateTask.mutate(payload as UpdateTaskInput, { onSuccess: onDone })
      return
    }

    createTask.mutate(payload as CreateTaskInput, {
      onSuccess: () => {
        reset()
        onDone()
      },
    })
  }

  const inputClass =
    'w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-law-accent focus:ring-2 focus:ring-law-accent/20'

  return (
    <>
      <Card className="border-law-accent/30 bg-law-accent/5">
        <CardContent className="p-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Görev Başlığı <span className="text-red-500">*</span>
              </label>
              <input
                {...register('title')}
                className={inputClass}
                placeholder="Görev başlığını girin..."
                autoFocus
              />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
              {duplicate && (
                <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Bu başlıkta bir görev zaten var: <strong>{duplicate.title}</strong>. Yine de
                    eklemek istersen devam edebilirsin.
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">İlgili Kayıt Türü</label>
              <div className="flex flex-wrap gap-1.5">
                {taskCategoryOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selectedCategory === option.value
                        ? 'border-law-accent bg-law-accent text-white'
                        : 'border-input bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      value={option.value}
                      {...register('category')}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {showCaseSelect && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {isCmkCategory ? 'İlgili CMK Dosyası' : 'İlgili Dava'}
                </label>
                <div className="flex gap-2">
                  <select {...register('caseId')} className={inputClass}>
                    <option value="">Seçilmedi</option>
                    {(isCmkCategory ? cmkList : casesList).map((item: any) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setCaseDialogOpen(true)}
                    className="flex-shrink-0 rounded-lg border px-3 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    title={isCmkCategory ? 'Yeni CMK dosyası ekle' : 'Yeni dava ekle'}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${isEdit ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {isEdit && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Durum</label>
                  <select {...register('status')} className={inputClass}>
                    {taskStatusValues.map((value) => (
                      <option key={value} value={value}>
                        {taskStatusLabels[value] || value}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium">Öncelik</label>
                <select {...register('priority')} className={inputClass}>
                  {taskPriorityValues.map((value) => (
                    <option key={value} value={value}>
                      {taskPriorityLabels[value] || value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Son Tarih</label>
                <input {...register('dueDate')} type="date" className={inputClass} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Açıklama</label>
              <textarea
                {...register('description')}
                rows={2}
                className={`${inputClass} resize-none`}
                placeholder="Görev detayları..."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Serbest Etiket</label>
              <input
                {...register('label')}
                list="task-labels"
                className={inputClass}
                placeholder="Baro Aidatı, Acil Takip..."
              />
              <datalist id="task-labels">
                {Array.from(
                  new Set(existingTasks.map((item: any) => item.label).filter(Boolean))
                ).map((value: any) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>

            <div className="flex justify-end gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50"
                >
                  İptal
                </button>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-law-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isEdit ? 'Kaydet' : 'Görev Ekle'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <QuickAddCaseDialog
        open={caseDialogOpen}
        onOpenChange={setCaseDialogOpen}
        defaultCmk={isCmkCategory}
        onCreated={(newCaseId) => setValue('caseId', newCaseId)}
      />
    </>
  )
}
