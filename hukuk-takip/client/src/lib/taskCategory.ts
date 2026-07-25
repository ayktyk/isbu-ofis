import { taskCategoryValues, type TaskCategory } from '@hukuk-takip/shared'

export const taskCategoryLabels: Record<TaskCategory, string> = {
  dava: 'Dava',
  cmk: 'CMK',
  arabuluculuk: 'Arabuluculuk',
  genel: 'Genel',
}

// Rozet renkleri — Tahsilatlar sayfasindaki kaynak renkleriyle tutarli:
// dava = mavi (law-accent), cmk = indigo, arabuluculuk = turuncu.
export const taskCategoryBadgeClass: Record<TaskCategory, string> = {
  dava: 'bg-law-accent/10 text-law-accent',
  cmk: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
  arabuluculuk: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  genel: 'bg-muted text-muted-foreground',
}

export const taskCategoryOptions = taskCategoryValues.map((value) => ({
  value,
  label: taskCategoryLabels[value],
}))

/**
 * Eski gorevlerde category NULL (backfill yapilmadi). Mumkunse bagli davadan
 * turet: CMK davasina bagliysa 'cmk', normal davaya bagliysa 'dava'.
 *
 * Turetilemezse null doner ve rozet gosterilmez — uydurma etiket basmayiz.
 */
export function resolveTaskCategory(task: {
  category?: string | null
  caseId?: string | null
  caseIsCmk?: boolean | null
}): TaskCategory | null {
  if (task.category && (taskCategoryValues as readonly string[]).includes(task.category)) {
    return task.category as TaskCategory
  }
  if (task.caseId) return task.caseIsCmk ? 'cmk' : 'dava'
  return null
}
