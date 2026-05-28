import { and, eq, gte, lte, inArray, isNotNull, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { caseHearings, tasks, notifications, cases } from '../db/schema.js'

type ScanResult = {
  upcomingHearings: number
  upcomingTasks: number
  overdueHearings: number
  overdueTasks: number
  criticalDeadlines: number
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

// Batch existence check — daha önce bu type için bildirim üretilmiş (userId, relatedId)
// çiftlerini tek query'de toplar. Per-iteration SELECT yerine bir kez 'inArray' ile çek.
// candidateIds boşsa hiç query atma.
async function fetchExistingNotificationIds(
  type: 'hearing' | 'task',
  candidateIds: string[],
): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set()
  const rows = await db
    .select({ userId: notifications.userId, relatedId: notifications.relatedId })
    .from(notifications)
    .where(and(eq(notifications.type, type), inArray(notifications.relatedId, candidateIds)))
  const seen = new Set<string>()
  for (const r of rows) {
    if (r.relatedId) seen.add(`${r.userId}|${r.relatedId}`)
  }
  return seen
}

// Yaklasan (0-3 gun) ve gecikmis (son 14 gun) gorev/durusmalar icin bildirim ureticisi.
// Gorev icin ek olarak tam saati gelen bildirim de uretilir ('task_due_now').
// relatedType ayrimi: 'hearing' / 'hearing_overdue', 'task' (3 gun once uyari) /
// 'task_due_now' (tam saatinde) / 'task_overdue' (gecikmis).
export async function runReminderScan(): Promise<ScanResult> {
  const scanStart = Date.now()
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
        inArray(caseHearings.result, ['pending', 'postponed']),
        isNull(caseHearings.archivedAt),
        isNull(cases.archivedAt)
      )
    )

  const upcomingHearingExisting = await fetchExistingNotificationIds(
    'hearing',
    upcomingHearings.map((h) => h.id),
  )

  const upcomingHearingInserts: typeof notifications.$inferInsert[] = []
  for (const hearing of upcomingHearings) {
    if (upcomingHearingExisting.has(`${hearing.userId}|${hearing.id}`)) {
      skipped++
      continue
    }

    const hearingDate = new Date(hearing.hearingDate)
    const daysLeft = daysBetween(now, hearingDate)
    const whenText =
      daysLeft <= 0 ? 'bugün' : daysLeft === 1 ? 'yarın' : `${daysLeft} gün sonra`

    upcomingHearingInserts.push({
      userId: hearing.userId,
      type: 'hearing',
      title: 'Duruşma Hatırlatması',
      message: `"${hearing.caseTitle}" davası için ${whenText} (${formatDateTimeTR(hearingDate)}) duruşma var.`,
      relatedId: hearing.id,
      relatedType: 'hearing',
      isRead: false,
      scheduledFor: hearingDate,
    })
  }
  if (upcomingHearingInserts.length > 0) {
    await db.insert(notifications).values(upcomingHearingInserts)
    upcomingHearingsCount = upcomingHearingInserts.length
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
        inArray(caseHearings.result, ['pending', 'postponed']),
        isNull(caseHearings.archivedAt),
        isNull(cases.archivedAt)
      )
    )

  const overdueHearingExisting = await fetchExistingNotificationIds(
    'hearing',
    overdueHearings.map((h) => h.id),
  )

  const overdueHearingInserts: typeof notifications.$inferInsert[] = []
  for (const hearing of overdueHearings) {
    if (overdueHearingExisting.has(`${hearing.userId}|${hearing.id}`)) {
      skipped++
      continue
    }

    const hearingDate = new Date(hearing.hearingDate)
    const daysAgo = Math.max(1, daysBetween(hearingDate, now))

    overdueHearingInserts.push({
      userId: hearing.userId,
      type: 'hearing',
      title: 'Geciken Duruşma',
      message: `"${hearing.caseTitle}" davasının duruşması ${daysAgo} gün önce (${formatDateTimeTR(hearingDate)}) idi ve hâlâ sonuçlandırılmadı.`,
      relatedId: hearing.id,
      relatedType: 'hearing_overdue',
      isRead: false,
      scheduledFor: hearingDate,
    })
  }
  if (overdueHearingInserts.length > 0) {
    await db.insert(notifications).values(overdueHearingInserts)
    overdueHearingsCount = overdueHearingInserts.length
  }

  // --- Yaklasan Gorevler (bugun dahil, sonraki 3 gun) — sadece NORMAL gorevler.
  // Sureli isler (is_deadline=true) asagidaki kritik blokta isleniyor.
  const upcomingTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, todayStart),
        lte(tasks.dueDate, upcomingEnd),
        inArray(tasks.status, ['pending', 'in_progress']),
        eq(tasks.isDeadline, false),
        isNull(tasks.archivedAt)
      )
    )

  const upcomingTaskExisting = await fetchExistingNotificationIds(
    'task',
    upcomingTasks.map((t) => t.id),
  )

  const upcomingTaskInserts: typeof notifications.$inferInsert[] = []
  for (const task of upcomingTasks) {
    if (upcomingTaskExisting.has(`${task.userId}|${task.id}`)) {
      skipped++
      continue
    }

    const dueDate = task.dueDate ? new Date(task.dueDate) : null
    const daysLeft = dueDate ? daysBetween(now, dueDate) : 0
    const whenText =
      daysLeft <= 0 ? 'bugün' : daysLeft === 1 ? 'yarın' : `${daysLeft} gün kaldı`

    upcomingTaskInserts.push({
      userId: task.userId,
      type: 'task',
      title: 'Görev Hatırlatması',
      message: `"${task.title}" görevi için ${whenText}.${dueDate ? ` Bitiş: ${formatDateTR(dueDate)}` : ''}`,
      relatedId: task.id,
      relatedType: 'task',
      isRead: false,
      scheduledFor: dueDate,
    })
  }
  if (upcomingTaskInserts.length > 0) {
    await db.insert(notifications).values(upcomingTaskInserts)
    upcomingTasksCount += upcomingTaskInserts.length
  }

  // --- Tam Saati Gelen Gorevler (bugun icinde vakti gelmis, hala pending/in_progress) ---
  // Scan en fazla 10 dk gecikme ile bu bildirimi uretir; her gorev icin tek sefer uretilir.
  // Sureli isler haricindeki gorevler — sureli isler kritik blokta isleniyor.
  // Not: upcomingTasks ile aynı (userId, relatedId, type) çakışmasını upcomingTaskExisting
  // örtüşür — bu bildirim de type='task' olduğundan aynı set'i kullanırız + yukarıdaki
  // batch'te eklenenleri de zikr et.
  const dueNowTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, todayStart),
        lte(tasks.dueDate, now),
        inArray(tasks.status, ['pending', 'in_progress']),
        eq(tasks.isDeadline, false),
        isNull(tasks.archivedAt)
      )
    )

  // Yeni eklenenleri de "var" say — aynı taskId için iki kez insert atmamak için.
  const dueNowExistingBase = await fetchExistingNotificationIds(
    'task',
    dueNowTasks.map((t) => t.id),
  )
  for (const ins of upcomingTaskInserts) {
    if (ins.relatedId) dueNowExistingBase.add(`${ins.userId}|${ins.relatedId}`)
  }

  const dueNowInserts: typeof notifications.$inferInsert[] = []
  for (const task of dueNowTasks) {
    if (dueNowExistingBase.has(`${task.userId}|${task.id}`)) {
      skipped++
      continue
    }

    const dueDate = task.dueDate ? new Date(task.dueDate) : null

    dueNowInserts.push({
      userId: task.userId,
      type: 'task',
      title: 'Görev Vakti Geldi',
      message: `"${task.title}" görevinin vakti geldi${dueDate ? ` (${formatDateTimeTR(dueDate)})` : ''}.`,
      relatedId: task.id,
      relatedType: 'task_due_now',
      isRead: false,
      scheduledFor: dueDate,
    })
  }
  if (dueNowInserts.length > 0) {
    await db.insert(notifications).values(dueNowInserts)
    upcomingTasksCount += dueNowInserts.length
  }

  // --- Gecikmis Gorevler (son 14 gun, hala pending/in_progress) — sadece NORMAL gorevler ---
  const overdueTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, overdueStart),
        lte(tasks.dueDate, overdueEnd),
        inArray(tasks.status, ['pending', 'in_progress']),
        eq(tasks.isDeadline, false),
        isNull(tasks.archivedAt)
      )
    )

  const overdueTaskExisting = await fetchExistingNotificationIds(
    'task',
    overdueTasks.map((t) => t.id),
  )

  const overdueTaskInserts: typeof notifications.$inferInsert[] = []
  for (const task of overdueTasks) {
    if (overdueTaskExisting.has(`${task.userId}|${task.id}`)) {
      skipped++
      continue
    }

    const dueDate = task.dueDate ? new Date(task.dueDate) : null
    const daysAgo = dueDate ? Math.max(1, daysBetween(dueDate, now)) : 0

    overdueTaskInserts.push({
      userId: task.userId,
      type: 'task',
      title: 'Geciken Görev',
      message: `"${task.title}" görevinin bitiş tarihi ${daysAgo} gün önce${dueDate ? ` (${formatDateTR(dueDate)})` : ''} geçti ve hâlâ tamamlanmadı.`,
      relatedId: task.id,
      relatedType: 'task_overdue',
      isRead: false,
      scheduledFor: dueDate,
    })
  }
  if (overdueTaskInserts.length > 0) {
    await db.insert(notifications).values(overdueTaskInserts)
    overdueTasksCount = overdueTaskInserts.length
  }

  // --- KRITIK SURELI ISLER ---
  // is_deadline=true olan gorevler icin 30/14/7/3/1/0 gun kala yeni bildirim
  // (legal_deadline_critical type) uretilir. relatedType='legal_deadline_<offset>'
  // alt etiketi sayesinde her offset icin tek sefer uretim olur.
  //
  // Batch stratejisi: tüm offset rotasyonlarını toplayıp, ardından TÜM relatedId'ler
  // için TEK SELECT ile mevcut legal_deadline_critical satırlarını çek. JS tarafında
  // her (userId, taskId, offset) için karar ver. Önceki davranış: kullanıcı bir offset'i
  // dismiss ettiyse diğer offset'ler de yaratılmaz.
  const CRITICAL_OFFSETS = [30, 14, 7, 3, 1, 0]
  let criticalDeadlinesCount = 0

  type CriticalCandidate = {
    task: typeof tasks.$inferSelect
    offset: number
    target: Date
    relatedType: string
  }
  const criticalCandidates: CriticalCandidate[] = []

  for (const offset of CRITICAL_OFFSETS) {
    const target = startOfDay(new Date(todayStart.getTime() + offset * 24 * 60 * 60 * 1000))
    const targetEnd = endOfDay(target)
    const relatedType = `legal_deadline_${offset}`

    const criticalRows = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.isDeadline, true),
          isNull(tasks.archivedAt),
          isNotNull(tasks.dueDate),
          gte(tasks.dueDate, target),
          lte(tasks.dueDate, targetEnd),
          inArray(tasks.status, ['pending', 'in_progress'])
        )
      )

    for (const task of criticalRows) {
      criticalCandidates.push({ task, offset, target, relatedType })
    }
  }

  // Tüm aday taskId'ler için legal_deadline_critical bildirimlerini tek seferde çek.
  // (userId, relatedId) bazında grupla; sameOffsetExists ve userDismissedAny kontrolü
  // JS tarafında yapılır. Önceki kod her offset × her task için ayrı SELECT atıyordu.
  const criticalRelatedIds = Array.from(new Set(criticalCandidates.map((c) => c.task.id)))
  const blockersByKey = new Map<string, Array<{ relatedType: string | null; dismissedAt: Date | null }>>()

  if (criticalRelatedIds.length > 0) {
    const blockerRows = await db
      .select({
        userId: notifications.userId,
        relatedId: notifications.relatedId,
        relatedType: notifications.relatedType,
        dismissedAt: notifications.dismissedAt,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.type, 'legal_deadline_critical'),
          inArray(notifications.relatedId, criticalRelatedIds),
        ),
      )

    for (const row of blockerRows) {
      if (!row.relatedId) continue
      const key = `${row.userId}|${row.relatedId}`
      const list = blockersByKey.get(key) ?? []
      list.push({ relatedType: row.relatedType, dismissedAt: row.dismissedAt })
      blockersByKey.set(key, list)
    }
  }

  // Aynı runReminderScan içinde aynı (userId, relatedId, relatedType) için iki kez
  // insert atmamak için lokal set — sameOffsetExists kontrolü hem DB'den hem de
  // bu run'da daha önce planlanmış insert'lerden gelir.
  const sessionPlanned = new Set<string>()
  const criticalInserts: typeof notifications.$inferInsert[] = []

  for (const { task, offset, relatedType } of criticalCandidates) {
    const key = `${task.userId}|${task.id}`
    const blockers = blockersByKey.get(key) ?? []
    const userDismissedAny = blockers.some((b) => b.dismissedAt !== null)
    const sameOffsetExistsDb = blockers.some((b) => b.relatedType === relatedType)
    const sameOffsetExistsSession = sessionPlanned.has(`${key}|${relatedType}`)

    if (userDismissedAny || sameOffsetExistsDb || sameOffsetExistsSession) {
      skipped++
      continue
    }

    const dueDate = task.dueDate ? new Date(task.dueDate) : null
    const severityText =
      task.deadlineSeverity === 'hak_dusurucu'
        ? 'HAK DÜŞÜRÜCÜ'
        : task.deadlineSeverity === 'zamanasimi'
          ? 'ZAMANAŞIMI'
          : 'SÜRELİ İŞ'

    const whenText =
      offset === 0
        ? 'BUGÜN SON GÜN'
        : offset === 1
          ? 'YARIN SON GÜN'
          : `${offset} gün kaldı`

    const titleText =
      offset <= 1 ? `🔴 ${severityText} — ${whenText}` : `⚠ ${severityText} — ${whenText}`

    const messageText =
      `"${task.title}" süreli işi için ${whenText.toLowerCase()}` +
      (dueDate ? ` (${formatDateTR(dueDate)})` : '') +
      (task.legalBasis ? ` — Dayanak: ${task.legalBasis}` : '') +
      '. Bu süre KAÇIRILMAMALIDIR.'

    criticalInserts.push({
      userId: task.userId,
      type: 'legal_deadline_critical',
      title: titleText,
      message: messageText,
      relatedId: task.id,
      relatedType,
      isRead: false,
      scheduledFor: dueDate,
    })
    sessionPlanned.add(`${key}|${relatedType}`)
  }

  if (criticalInserts.length > 0) {
    await db.insert(notifications).values(criticalInserts)
    criticalDeadlinesCount = criticalInserts.length
  }

  const result: ScanResult = {
    upcomingHearings: upcomingHearingsCount,
    upcomingTasks: upcomingTasksCount,
    overdueHearings: overdueHearingsCount,
    overdueTasks: overdueTasksCount,
    criticalDeadlines: criticalDeadlinesCount,
    skipped,
  }

  // Performans izleme: cron yükünü doğrulamak için süre ve insert sayısını logla.
  // Sentry/pino eklenince yapısal log'a çevrilir; şimdilik plain console.
  const elapsedMs = Date.now() - scanStart
  const insertedTotal =
    upcomingHearingsCount + overdueHearingsCount + upcomingTasksCount + overdueTasksCount + criticalDeadlinesCount
  console.log(
    `[reminderScan] ${elapsedMs}ms — inserts=${insertedTotal} skipped=${skipped} ` +
      `(uH=${upcomingHearingsCount} oH=${overdueHearingsCount} uT=${upcomingTasksCount} oT=${overdueTasksCount} cD=${criticalDeadlinesCount})`,
  )

  return result
}
