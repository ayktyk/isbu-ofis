import { Router, type Request, type Response } from 'express'
import { and, eq, isNotNull, ne } from 'drizzle-orm'
import { db } from '../db/index.js'
import { caseHearings, cases, clients, tasks } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import {
  getCalendarIntegrationStatus,
  syncHearingToGoogleCalendar,
  syncTaskToGoogleCalendar,
  runCalendarDiagnostic,
} from '../utils/googleCalendar.js'

const router = Router()
router.use(authenticate)

router.get('/integration', (_req: Request, res: Response) => {
  res.json(getCalendarIntegrationStatus())
})

// Aşamalı teşhis: config → token → calendar erişim → event yazma/silme.
// Her adım success/error detayı döner. Bağlantı problemi olduğunda hangi
// adımda ne mesaj aldığı hemen görülür.
router.get('/debug', async (_req: Request, res: Response) => {
  const result = await runCalendarDiagnostic()
  res.json(result)
})

router.post('/resync', async (req: Request, res: Response) => {
  const status = getCalendarIntegrationStatus()

  if (!status.configured) {
    res.status(400).json({ error: 'Google Calendar henuz yapilandirilmamis.' })
    return
  }

  const taskRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      dueDate: tasks.dueDate,
      label: tasks.label,
      status: tasks.status,
      caseTitle: cases.title,
    })
    .from(tasks)
    .leftJoin(cases, eq(tasks.caseId, cases.id))
    .where(
      and(
        eq(tasks.userId, req.user!.userId),
        isNotNull(tasks.dueDate),
        ne(tasks.status, 'completed'),
        ne(tasks.status, 'cancelled')
      )
    )

  const hearingRows = await db
    .select({
      id: caseHearings.id,
      hearingDate: caseHearings.hearingDate,
      result: caseHearings.result,
      notes: caseHearings.notes,
      courtRoom: caseHearings.courtRoom,
      judge: caseHearings.judge,
      caseTitle: cases.title,
      caseNumber: cases.caseNumber,
      courtName: cases.courtName,
      clientName: clients.fullName,
    })
    .from(caseHearings)
    .innerJoin(cases, eq(caseHearings.caseId, cases.id))
    .leftJoin(clients, eq(cases.clientId, clients.id))
    .where(
      and(
        eq(cases.userId, req.user!.userId),
        ne(caseHearings.result, 'completed'),
        ne(caseHearings.result, 'cancelled')
      )
    )

  type FailureDetail = {
    type: 'task' | 'hearing'
    id: string
    title: string | null
    date: string | null
    error: string
  }
  const failures: FailureDetail[] = []
  let syncedTasks = 0
  let syncedHearings = 0

  function formatError(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
  }

  function toIsoOrNull(value: Date | string | null | undefined): string | null {
    if (!value) return null
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return null
    try {
      return d.toISOString()
    } catch {
      return null
    }
  }

  // Chunk'lı paralel senkron — Google Calendar quota güvenli (kullanıcı başına
  // ~10 req/sn limiti var); 5'er grup halinde Promise.allSettled kullanıyoruz,
  // böylece 50 kayıt 50 saniye yerine ~5-10 sn'de biter.
  const CONCURRENCY = 5

  async function runChunked<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const chunk = items.slice(i, i + CONCURRENCY)
      await Promise.allSettled(chunk.map(worker))
    }
  }

  await runChunked(taskRows, async (task) => {
    try {
      await syncTaskToGoogleCalendar({
        taskId: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        label: task.label,
        status: task.status,
        caseTitle: task.caseTitle,
      })
      syncedTasks += 1
    } catch (error) {
      failures.push({
        type: 'task',
        id: task.id,
        title: task.title,
        date: toIsoOrNull(task.dueDate),
        error: formatError(error),
      })
      console.error('[GoogleCalendar] Task resync failed', task.id, error)
    }
  })

  await runChunked(hearingRows, async (hearing) => {
    try {
      await syncHearingToGoogleCalendar({
        hearingId: hearing.id,
        hearingDate: hearing.hearingDate,
        result: hearing.result,
        notes: hearing.notes,
        courtRoom: hearing.courtRoom,
        judge: hearing.judge,
        caseTitle: hearing.caseTitle,
        caseNumber: hearing.caseNumber,
        courtName: hearing.courtName,
        clientName: hearing.clientName,
      })
      syncedHearings += 1
    } catch (error) {
      failures.push({
        type: 'hearing',
        id: hearing.id,
        title: hearing.caseTitle,
        date: toIsoOrNull(hearing.hearingDate),
        error: formatError(error),
      })
      console.error('[GoogleCalendar] Hearing resync failed', hearing.id, error)
    }
  })

  // İlk failure'dan özet hata mesajı üret — UI'da gösterilecek.
  // Tekrar eden 403/401 hataları büyük ihtimalle paylaşım/yetki sorunudur.
  const firstError = failures[0]?.error || null
  const hint = firstError
    ? firstError.includes('403')
      ? 'Servis hesabı takvime yazamıyor. Google Calendar\'da takvimi service account e-postasıyla "Etkinlikleri değiştir" yetkisiyle paylaşmanız gerekiyor.'
      : firstError.includes('401')
        ? 'Yetkilendirme hatası. GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY veya EMAIL değerlerini kontrol edin.'
        : firstError.includes('404')
          ? 'Takvim bulunamadı. GOOGLE_CALENDAR_ID doğru mu?'
          : /Invalid (start|end) time|gecersiz|cok eski|okunamadi|ISO formatina/i.test(firstError)
            ? 'Bazı kayıtların tarihi geçersiz veya çok eski. Aşağıdaki listeye bakıp ilgili görev/duruşma tarihlerini düzeltin.'
            : null
    : null

  res.json({
    configured: true,
    syncedTasks,
    syncedHearings,
    failedCount: failures.length,
    failures,
    firstError,
    hint,
  })
})

export default router
