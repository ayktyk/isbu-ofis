import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createTaskSchema,
  updateTaskSchema,
  taskPriorityValues,
  taskStatusValues,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@hukuk-takip/shared'
import { AlertTriangle, Lightbulb, Loader2, Plus, Save } from 'lucide-react'
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks'
import { taskPriorityLabels, taskStatusLabels } from '@/lib/utils'
import { taskCategoryOptions } from '@/lib/taskCategory'
import { findDuplicateTitle } from '@/lib/textSearch'
import { STRONG_SUGGESTION_SCORE, suggestCases, type CaseOption } from '@/lib/caseSuggest'
import { Card, CardContent } from '@/components/ui/card'
import CaseCombobox, { type CaseListStatus } from '@/components/shared/CaseCombobox'
import QuickAddCaseDialog from '@/components/shared/QuickAddCaseDialog'
import CaseSuggestionChips from './CaseSuggestionChips'

type TaskFormValues = CreateTaskInput & Pick<UpdateTaskInput, 'status'>

const NO_CASES: CaseOption[] = []

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
  caseTotal,
  casesStatus = 'ready',
  existingTasks,
  onDone,
  onCancel,
}: {
  mode: 'create' | 'edit'
  task?: any
  casesList: CaseOption[]
  cmkList: CaseOption[]
  // Sunucudaki toplam dava sayisi (yuklenenden fazlaysa secicide not cikar) ve
  // listenin durumu (yuklenirken secici "dava yok" demesin).
  caseTotal?: number
  casesStatus?: CaseListStatus
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
    control,
    handleSubmit,
    reset,
    watch,
    getValues,
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
  const watchedDescription = watch('description') || ''
  const selectedCaseId = watch('caseId') || ''
  const showCaseSelect = selectedCategory === 'dava' || selectedCategory === 'cmk'
  const isCmkCategory = selectedCategory === 'cmk'

  // Ayni baslikta gorev zaten varsa uyarilir — ENGELLENMEZ. Avukat bilerek
  // benzer gorev ekleyebilir; amac yanlislikla iki kez yazmayi onlemek.
  const duplicate = findDuplicateTitle(watchedTitle, existingTasks, isEdit ? task?.id : undefined)

  // Oneri metni baslik + aciklama. useDeferredValue: 1000 davalik tarama
  // yazarken klavyeyi bekletmesin — harf hemen basilir, oneri bosta hesaplanir.
  const suggestionText = useDeferredValue(`${watchedTitle} ${watchedDescription}`)

  // 'genel'de iki liste de taranir: gorev aslinda bir dosyayla ilgiliyse ipucu
  // verilir. 'arabuluculuk' davaya baglanmaz (avukat karari) — oneri de yok.
  const suggestionPool = useMemo(() => {
    if (selectedCategory === 'dava') return casesList
    if (selectedCategory === 'cmk') return cmkList
    if (selectedCategory === 'genel') return [...casesList, ...cmkList]
    return NO_CASES
  }, [selectedCategory, casesList, cmkList])

  const suggestions = useMemo(
    () => suggestCases(suggestionText, suggestionPool),
    [suggestionText, suggestionPool]
  )
  const suggestedCases = useMemo(() => suggestions.map((item) => item.case), [suggestions])
  const strongSuggestions = useMemo(
    () =>
      suggestions
        .filter((item) => item.score >= STRONG_SUGGESTION_SCORE)
        .slice(0, 2)
        .map((item) => item.case),
    [suggestions]
  )

  // Kategori dava/cmk'ya gecince secili dava yeni listede yoksa ama oteki
  // listedeyse baglanti temizlenir: normal dava CMK seciminde (ya da tersi)
  // gorunmez sekilde secili kalmasin. Ilk acilista calismaz (onceki kategori
  // ref'te); listelerde hic olmayan (arsivlenmis) baglantiya dokunulmaz.
  // Listeler henuz gelmediyse kontrol bekler, gelince bir kez yapilir.
  const previousCategory = useRef(selectedCategory)
  const pendingCaseCheck = useRef(false)
  useEffect(() => {
    const changed = previousCategory.current !== selectedCategory
    previousCategory.current = selectedCategory
    if (!changed && !pendingCaseCheck.current) return
    pendingCaseCheck.current = false
    if (selectedCategory !== 'dava' && selectedCategory !== 'cmk') return
    pendingCaseCheck.current = casesStatus !== 'ready'
    if (pendingCaseCheck.current) return

    const caseId = getValues('caseId')
    if (!caseId) return
    const nextList = selectedCategory === 'cmk' ? cmkList : casesList
    const otherList = selectedCategory === 'cmk' ? casesList : cmkList
    const inNext = nextList.some((item) => item.id === caseId)
    if (!inNext && otherList.some((item) => item.id === caseId)) {
      setValue('caseId', '', { shouldDirty: true })
    }
  }, [selectedCategory, casesList, cmkList, casesStatus, getValues, setValue])

  // Secili dava acik listede yoksa (arsivlenmis, ya da + ile yeni eklenmis ve
  // liste henuz yenilenmemis) secicide gosterilecek ad. Gorevin eski dava adi
  // yalniz o dava hala seciliyse kullanilir; yoksa yeni dava eski adla gorunurdu.
  const fallbackLabel = useMemo(() => {
    if (!selectedCaseId) return null
    const known =
      casesList.find((item) => item.id === selectedCaseId) ??
      cmkList.find((item) => item.id === selectedCaseId)
    if (known) return known.title
    return task?.caseId === selectedCaseId ? task?.caseTitle ?? null : null
  }, [selectedCaseId, casesList, cmkList, task])

  function pickSuggestedCase(item: CaseOption) {
    setValue('caseId', item.id, { shouldDirty: true })
  }

  // 'genel' ipucundan secim: kategori de davanin turune gore degisir.
  function pickCategorySuggestion(item: CaseOption) {
    setValue('category', item.isCmkAssignment ? 'cmk' : 'dava', { shouldDirty: true })
    setValue('caseId', item.id, { shouldDirty: true })
  }

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

              {/* Oneri yalniz ipucu: dokunulmadikca kategori ve dava degismez. */}
              {selectedCategory === 'genel' && strongSuggestions.length > 0 && (
                <div className="mt-2 rounded-lg border border-dashed border-accent/40 bg-background/70 p-2.5">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lightbulb className="h-3.5 w-3.5 flex-shrink-0" />
                    Bu görev şu dosyayla ilgili olabilir:
                  </p>
                  <CaseSuggestionChips items={strongSuggestions} onPick={pickCategorySuggestion} />
                </div>
              )}
            </div>

            {showCaseSelect && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {isCmkCategory ? 'İlgili CMK Dosyası' : 'İlgili Dava'}
                </label>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <Controller
                      control={control}
                      name="caseId"
                      render={({ field }) => (
                        <CaseCombobox
                          value={field.value || ''}
                          onChange={field.onChange}
                          cases={isCmkCategory ? cmkList : casesList}
                          suggestions={suggestedCases}
                          fallbackLabel={fallbackLabel}
                          totalAvailable={caseTotal}
                          loadedCount={casesList.length + cmkList.length}
                          status={casesStatus}
                          kind={isCmkCategory ? 'cmk' : 'dava'}
                          ariaLabel={isCmkCategory ? 'İlgili CMK dosyası' : 'İlgili dava'}
                        />
                      )}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCaseDialogOpen(true)}
                    className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    title={isCmkCategory ? 'Yeni CMK dosyası ekle' : 'Yeni dava ekle'}
                    aria-label={isCmkCategory ? 'Yeni CMK dosyası ekle' : 'Yeni dava ekle'}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {/* Yer ayrilir: aciklama yazilirken cip cikip kaybolunca alttaki alanlar oynamasin. */}
                {!selectedCaseId && (
                  <div className="mt-2 min-h-11 sm:min-h-9">
                    <CaseSuggestionChips items={suggestedCases} onPick={pickSuggestedCase} label="Önerilen:" />
                  </div>
                )}
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

      {/* key: diyalog CMK kutusunu ilk kurulusta okur; kategori degisince yeniden kurulsun. */}
      <QuickAddCaseDialog
        key={isCmkCategory ? 'cmk' : 'dava'}
        open={caseDialogOpen}
        onOpenChange={setCaseDialogOpen}
        defaultCmk={isCmkCategory}
        onCreated={(newCaseId) => setValue('caseId', newCaseId, { shouldDirty: true })}
      />
    </>
  )
}
