import { and, eq, gte, lte, inArray, isNotNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { caseHearings, tasks, notifications, cases } from '../db/schema.js'

type ScanResult = {
  upcomingHearings: number
  upcomingTasks: number
  overdueHearings: number
  overdueTasks: number
  skipped: number
}

// ─── On-demand scan cooldown & single-flight ─────────────────────────────────
// Render Free + Vercel gibi ortamlarda cron güvenilir olmadığı için kullanıcı
// bildirim/dashboard endpoint'lerini çağırdığında arka planda scan tetikleriz.
// Concurrent çağrıları tek bir promise'a bağlar, 10 dakikadan yeni bir scan
// varsa yeniden çalıştırmaz.

const MIN_SCAN_INTERVAL_MS = 10 * 60 * 1000 // 10 dakika
let lastScanAt = 0
let inFlight: Promise<ScanResult> | null = null

// Cooldown dahilinde skip eder; aksi halde scan'i tetikler ve sonucunu döndürür.
// İsteyen caller await eder, istemeyen fire-and-forget kullanır.
export function ensureRecentReminderScan(force = false): Promise<ScanResult> | null {
  const now = Date.now()
  if (!force && lastScanAt && now - lastScanAt < MIN_SCAN_INTERVAL_MS) {
    return null // Yakın zamanda tarandı, yeniden tarama yok
  }
  if (inFlight) return inFlight

  inFlight = runReminderScan()
    .then((result) => {
      lastScanAt = Date.now()
      return result
    })
    .catch((err) => {
      console.error('ensureRecentReminderScan hata:', err)
      // Hata olsa da inFlight temizle ki bir sonraki deneme yapılabilsin
      throw err
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

export function getLastReminderScanAt(): number {
  return lastScanAt
}


function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}

function formatDateTimeTR(value: Date) {
  return value.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTR(value: Date) {
  return value.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function daysBetween(from: Date, to: Date) {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / msPerDay)
}

// Yaklasan (0-3 gun) ve gecikmis (son 14 gun) gorev/durusmalar icin bildirim ureticisi.
// Gorev icin ek olarak tam saati gelen bildirim de uretilir ('task_due_now').
// relatedType ayrimi: 'hearing' / 'hearing_overdue', 'task' (3 gun once uyari) /
// 'task_due_now' (tam saatinde) / 'task_overdue' (gecikmis).
export async function runReminderScan(): Promise<ScanResult> {
  const now = new Date()
  const todayStart = startOfDay(now)
  const upcomingEnd = endOfDay(new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000))
  const overdueEnd = new Date(todayStart.getTime() - 1)
  const overdueStart = startOfDay(new Date(todayStart.getTime() - 14 * 24 * 60 * 60 * 1000))

  let upcomingHearingsCount = 0
  let upcomingTasksCount = 0
  let overdueHearingsCount = 0
  let overdueTasksCount = 0
  let skipped = 0

  // --- Yaklasan Durusmalar (bugun dahil, sonraki 3 gun) ---
  const upcomingHearings = await db
    .select({
      id: caseHearings.id,
      hearingDate: caseHearings.hearingDate,
      result: caseHearings.result,
      caseTitle: cases.title,
      userId: cases.userId,
    })
    .from(caseHearings)
    .innerJoin(cases, eq(caseHearings.caseId, cases.id))
    .where(
      and(
        gte(caseHearings.hearingDate, todayStart),
        lte(caseHearings.hearingDate, upcomingEnd),
        inArray(caseHearings.result, ['pending', 'postponed'])
      )
    )

  for (const hearing of upcomingHearings) {
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, hearing.userId),
          eq(notifications.type, 'hearing'),
          eq(notifications.relatedId, hearing.id),
          eq(notifications.relatedType, 'hearing')
        )
      )
      .limit(1)

    if (existing.length > 0) {
      skipped++
      continue
    }

    const hearingDate = new Date(hearing.hearingDate)
    const daysLeft = daysBetween(now, hearingDate)
    const whenText =
      daysLeft <= 0 ? 'bugün' : daysLeft === 1 ? 'yarın' : `${daysLeft} gün sonra`

    await db.insert(notifications).values({
      userId: hearing.userId,
      type: 'hearing',
      title: 'Duruşma Hatırlatması',
      message: `"${hearing.caseTitle}" davası için ${whenText} (${formatDateTimeTR(hearingDate)}) duruşma var.`,
      relatedId: hearing.id,
      relatedType: 'hearing',
      isRead: false,
      scheduledFor: hearingDate,
    })
    upcomingHearingsCount++
  }

  // --- Gecikmis Durusmalar (son 14 gun, hala beklemede/ertelenmis) ---
  const overdueHearings = await db
    .select({
      id: caseHearings.id,
      hearingDate: caseHearings.hearingDate,
      caseTitle: cases.title,
      userId: cases.userId,
    })
    .from(caseHearings)
    .innerJoin(cases, eq(caseHearings.caseId, cases.id))
    .where(
      and(
        gte(caseHearings.hearingDate, overdueStart),
        lte(caseHearings.hearingDate, overdueEnd),
        inArray(caseHearings.result, ['pending', 'postponed'])
      )
    )

  for (const hearing of overdueHearings) {
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, hearing.userId),
          eq(notifications.type, 'hearing'),
          eq(notifications.relatedId, hearing.id),
          eq(notifications.relatedType, 'hearing_overdue')
        )
      )
      .limit(1)

    if (existing.length > 0) {
      skipped++
      continue
    }

    const hearingDate = new Date(hearing.hearingDate)
    const daysAgo = Math.max(1, daysBetween(hearingDate, now))

    await db.insert(notifications).values({
      userId: hearing.userId,
      type: 'hearing',
      title: 'Geciken Duruşma',
      message: `"${hearing.caseTitle}" davasının duruşması ${daysAgo} gün önce (${formatDateTimeTR(hearingDate)}) idi ve hâlâ sonuçlandırılmadı.`,
      relatedId: hearing.id,
      relatedType: 'hearing_overdue',
      isRead: false,
      scheduledFor: hearingDate,
    })
    overdueHearingsCount++
  }

  // --- Yaklasan Gorevler (bugun dahil, sonraki 3 gun) ---
  const upcomingTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, todayStart),
        lte(tasks.dueDate, upcomingEnd),
        inArray(tasks.status, ['pending', 'in_progress'])
      )
    )

  for (const task of upcomingTasks) {
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, task.userId),
          eq(notifications.type, 'task'),
          eq(notifications.relatedId, task.id),
          eq(notifications.relatedType, 'task')
        )
      )
      .limit(1)

    if (existing.length > 0) {
      skipped++
      continue
    }

    const dueDate = task.dueDate ? new Date(task.dueDate) : null
    const daysLeft = dueDate ? daysBetween(now, dueDate) : 0
    const whenText =
      daysLeft <= 0 ? 'bugün' : daysLeft === 1 ? 'yarın' : `${daysLeft} gün kaldı`

    await db.insert(notifications).values({
      userId: task.userId,
      type: 'task',
      title: 'Görev Hatırlatması',
      message: `"${task.title}" görevi için ${whenText}.${dueDate ? ` Bitiş: ${formatDateTR(dueDate)}` : ''}`,
      relatedId: task.id,
      relatedType: 'task',
      isRead: false,
      scheduledFor: dueDate,
    })
    upcomingTasksCount++
  }

  // --- Tam Saati Gelen Gorevler (bugun icinde vakti gelmis, hala pending/in_progress) ---
  // Scan en fazla 10 dk gecikme ile bu bildirimi uretir; her gorev icin tek sefer uretilir.
  const dueNowTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, todayStart),
        lte(tasks.dueDate, now),
        inArray(tasks.status, ['pending', 'in_progress'])
      )
    )

  for (const task of dueNowTasks) {
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, task.userId),
          eq(notifications.type, 'task'),
          eq(notifications.relatedId, task.id),
          eq(notifications.relatedType, 'task_due_now')
        )
      )
      .limit(1)

    if (existing.length > 0) {
      skipped++
      continue
    }

    const dueDate = task.dueDate ? new Date(task.dueDate) : null

    await db.insert(notifications).values({
      userId: task.userId,
      type: 'task',
      title: 'Görev Vakti Geldi',
      message: `"${task.title}" görevinin vakti geldi${dueDate ? ` (${formatDateTimeTR(dueDate)})` : ''}.`,
      relatedId: task.id,
      relatedType: 'task_due_now',
      isRead: false,
      scheduledFor: dueDate,
    })
    upcomingTasksCount++
  }

  // --- Gecikmis Gorevler (son 14 gun, hala pending/in_progress) ---
  const overdueTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, overdueStart),
        lte(tasks.dueDate, overdueEnd),
        inArray(tasks.status, ['pending', 'in_progress'])
      )
    )

  for (const task of overdueTasks) {
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, task.userId),
          eq(notifications.type, 'task'),
          eq(notifications.relatedId, task.id),
          eq(notifications.relatedType, 'task_overdue')
        )
      )
      .limit(1)

    if (existing.length > 0) {
      skipped++
      continue
    }

    const dueDate = task.dueDate ? new Date(task.dueDate) : null
    const daysAgo = dueDate ? Math.max(1, daysBetween(dueDate, now)) : 0

    await db.insert(notifications).values({
      userId: task.userId,
      type: 'task',
      title: 'Geciken Görev',
      message: `"${task.title}" görevinin bitiş tarihi ${daysAgo} gün önce${dueDate ? ` (${formatDateTR(dueDate)})` : ''} geçti ve hâlâ tamamlanmadı.`,
      relatedId: task.id,
      relatedType: 'task_overdue',
      isRead: false,
      scheduledFor: dueDate,
    })
    overdueTasksCount++
  }

  return {
    upcomingHearings: upcomingHearingsCount,
    upcomingTasks: upcomingTasksCount,
    overdueHearings: overdueHearingsCount,
    overdueTasks: overdueTasksCount,
    skipped,
  }
}
