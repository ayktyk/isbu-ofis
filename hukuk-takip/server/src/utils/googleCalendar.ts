import { createPrivateKey, createSign } from 'node:crypto'

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const DEFAULT_REMINDER_MINUTES = 3 * 24 * 60
const DEFAULT_TIME_ZONE = 'Europe/Istanbul'

type CalendarEventDate =
  | { date: string }
  | { dateTime: string; timeZone?: string }

type CalendarEventPayload = {
  summary: string
  description?: string
  location?: string
  start: CalendarEventDate
  end: CalendarEventDate
  reminders: {
    useDefault: false
    overrides: Array<{ method: 'popup' | 'email'; minutes: number }>
  }
  extendedProperties: {
    private: Record<string, string>
  }
}

type MinimalCalendarEvent = {
  id: string
}

export type TaskCalendarSyncInput = {
  taskId: string
  title: string
  dueDate?: Date | string | null
  description?: string | null
  label?: string | null
  status?: string | null
  caseTitle?: string | null
}

export type HearingCalendarSyncInput = {
  hearingId: string
  hearingDate?: Date | string | null
  result?: string | null
  caseTitle?: string | null
  caseNumber?: string | null
  courtName?: string | null
  courtRoom?: string | null
  judge?: string | null
  clientName?: string | null
  notes?: string | null
}

// Private key temizleme — Render/Vercel env'lerinde yaygın formatlama sorunlarını
// toleranslı çözer:
// - Başta/sonda tek veya çift tırnak (kopya-yapıştır hatası)
// - \\n literal'lerini gerçek newline'a çevir
// - \r\n (CRLF) → \n (LF), tek başına \r'ları da kaldır
// - Trim whitespace
// - Sonuna trailing newline garantile (PEM standartı)
// - Opsiyonel: GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64 varsa base64 olarak decode et
function normalizePrivateKey(raw: string | undefined): string | null {
  if (!raw) return null
  let key = raw

  // Başta/sonda tırnak varsa kaldır
  key = key.trim()
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }

  // Escape edilmiş \n'leri gerçek newline yap
  key = key.replace(/\\n/g, '\n')
  // CRLF → LF
  key = key.replace(/\r\n/g, '\n')
  // Tek başına \r karakterlerini de kaldır
  key = key.replace(/\r/g, '')

  key = key.trim()
  // PEM trailing newline zorunlu
  if (!key.endsWith('\n')) key = key + '\n'

  return key
}

function getCalendarConfig() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim()
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()

  // Önce base64 varyantını dene (en güvenli yol), yoksa düz PEM'i normalize et
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64?.trim()
  let privateKey: string | null = null
  if (b64) {
    try {
      privateKey = Buffer.from(b64, 'base64').toString('utf8').trim()
      if (!privateKey.endsWith('\n')) privateKey += '\n'
    } catch {
      privateKey = null
    }
  }
  if (!privateKey) {
    privateKey = normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
  }

  const reminderMinutes = Number.parseInt(
    process.env.GOOGLE_CALENDAR_REMINDER_MINUTES || `${DEFAULT_REMINDER_MINUTES}`,
    10
  )

  if (!calendarId || !clientEmail || !privateKey) {
    return null
  }

  return {
    calendarId,
    clientEmail,
    privateKey,
    reminderMinutes: Number.isFinite(reminderMinutes) ? reminderMinutes : DEFAULT_REMINDER_MINUTES,
    timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE || DEFAULT_TIME_ZONE,
  }
}

function base64UrlEncode(value: string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function getGoogleAccessToken() {
  const config = getCalendarConfig()
  if (!config) {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: config.clientEmail,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: GOOGLE_OAUTH_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    })
  )

  // Önce key'i parse etmeyi dene — daha anlaşılır hata mesajı için
  let keyObject
  try {
    keyObject = createPrivateKey(config.privateKey)
  } catch (parseErr) {
    throw new Error(
      `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY parse edilemedi. ` +
        `Muhtemel sebepler: (1) Render env değerinde başta/sonda tırnak var, ` +
        `(2) satır sonları bozuk, (3) key PKCS#8 formatında değil. ` +
        `Çözüm: JSON key dosyasındaki "private_key" değerini tırnak dahil etmeden ` +
        `Render'a yapıştır veya base64 kodlayıp GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64 ` +
        `olarak ayrıca tanımla. Orijinal hata: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
    )
  }

  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claimSet}`)
  signer.end()

  const signature = signer
    .sign(keyObject)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

  const assertion = `${header}.${claimSet}.${signature}`

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Google token request failed: ${response.status} ${errorBody}`)
  }

  const data = (await response.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new Error('Google token response did not include access_token')
  }

  return data.access_token
}

async function googleCalendarRequest<T>(path: string, init?: RequestInit) {
  const config = getCalendarConfig()
  if (!config) {
    throw new Error('Google Calendar is not configured')
  }

  const accessToken = await getGoogleAccessToken()
  if (!accessToken) {
    throw new Error('Google Calendar access token could not be created')
  }

  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Google Calendar request failed: ${response.status} ${errorBody}`)
  }

  if (response.status === 204) {
    return null as T
  }

  return (await response.json()) as T
}

/**
 * Google Calendar reminder'i geçmişte kalıyorsa (yakın tarihe event eklenirse)
 * bildirim tetiklenmiyor. Event başlangıcı ile şu an arasındaki farkı hesaplar,
 * kullanıcı tercihi (defaultMinutes) bunu aşarsa otomatik olarak güvenli bir
 * değere düşürür. Böylece 3 saat sonraya eklenen duruşma için 3 gün önceye
 * reminder konmaz, mevcut zamana en yakın makul değer (örn. 5 dk önce) konur.
 *
 * Google Calendar üst sınır: 40320 dakika (28 gün). Alt sınır: 0.
 */
function resolveReminderMinutes(eventStart: Date, defaultMinutes: number): number {
  const now = Date.now()
  const minutesUntilEvent = Math.floor((eventStart.getTime() - now) / 60000)
  // Event zaten geçmişte → reminder işlevsiz, 0 dönelim (Google yine de kaydeder).
  if (minutesUntilEvent <= 0) return 0
  // Event çok yakın (defaultMinutes içinde) → olabildiğince erken reminder.
  // 1 dakika pay bırak (tam anında bazen kaçabilir).
  if (minutesUntilEvent <= defaultMinutes) {
    return Math.max(0, minutesUntilEvent - 1)
  }
  // Google üst sınırı 40320 dakika (28 gün); aşarsa clamp.
  return Math.min(defaultMinutes, 40320)
}

function buildReminderOverrides(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(40320, Math.round(minutes)))
  return {
    useDefault: false as const,
    overrides: [
      { method: 'popup' as const, minutes: safeMinutes },
      { method: 'email' as const, minutes: safeMinutes },
    ],
  }
}

function getEntityKey(entityType: 'task' | 'hearing', entityId: string) {
  return `${entityType}:${entityId}`
}

function toDate(value?: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

function toDateOnlyString(value: Date) {
  return value.toISOString().slice(0, 10)
}

function addDays(value: Date, amount: number) {
  const copy = new Date(value)
  copy.setUTCDate(copy.getUTCDate() + amount)
  return copy
}

function addMinutes(value: Date, amount: number) {
  return new Date(value.getTime() + amount * 60 * 1000)
}

// Google Calendar geçerli tarih sınırı: 1970-01-01 UTC altındaki değerleri
// "Invalid start time" diye reddediyor. Ayrıca NaN / bozuk Date de ISO
// üretmeden RangeError atar. buildTask/Hearing içinden kullanılan tek noktalı guard.
const MIN_CALENDAR_MS = Date.UTC(1970, 0, 1)

function ensureValidCalendarDate(date: Date, rawInput: unknown, label: string): void {
  const ms = date.getTime()
  if (!Number.isFinite(ms)) {
    throw new Error(`${label} icin takvim tarihi okunamadi (${String(rawInput)}).`)
  }
  if (ms < MIN_CALENDAR_MS) {
    throw new Error(`${label} icin takvim tarihi cok eski: ${date.toISOString()} (1970 oncesi kabul edilmiyor).`)
  }
}

function buildTaskEventPayload(
  input: TaskCalendarSyncInput,
  reminderMinutes: number,
  timeZone: string
): CalendarEventPayload {
  const dueDate = toDate(input.dueDate)
  const taskLabel = `Gorev "${input.title}"`
  if (!dueDate) {
    throw new Error(`${taskLabel} icin son tarih bos — takvime eklenemiyor.`)
  }

  const descriptionLines = [
    input.caseTitle ? `Dava: ${input.caseTitle}` : null,
    input.label ? `Etiket: ${input.label}` : null,
    input.description ? `Aciklama: ${input.description}` : null,
    'Bu gorev Isbu Ofis tarafindan otomatik senkronlandi.',
  ].filter(Boolean)

  // Timed event olarak oluştur — all-day event'te reminder 00:00 UTC'ye göre
  // hesaplanıyor (Türkiye'de gece 03:00) ve past reminder'lar tetiklenmiyor.
  // Default 09:00 kullanıyoruz; user saat girdiyse (saat 00:00 değilse) onu koru.
  const eventStart = new Date(dueDate)
  const hasUserTime =
    eventStart.getHours() !== 0 ||
    eventStart.getMinutes() !== 0 ||
    eventStart.getSeconds() !== 0
  if (!hasUserTime) {
    eventStart.setHours(9, 0, 0, 0)
  }
  ensureValidCalendarDate(eventStart, input.dueDate, taskLabel)

  // eventEnd kesinlikle start'tan sonra olmalı; savunmacı +30dk
  const eventEnd = new Date(Math.max(eventStart.getTime() + 30 * 60 * 1000, eventStart.getTime() + 1))

  let startIso: string
  let endIso: string
  try {
    startIso = eventStart.toISOString()
    endIso = eventEnd.toISOString()
  } catch {
    throw new Error(`${taskLabel} icin takvim tarihi ISO formatina cevrilemedi (${input.dueDate}).`)
  }

  return {
    summary: `Gorev: ${input.title}`,
    description: descriptionLines.join('\n'),
    start: { dateTime: startIso, timeZone },
    end: { dateTime: endIso, timeZone },
    reminders: buildReminderOverrides(resolveReminderMinutes(eventStart, reminderMinutes)),
    extendedProperties: {
      private: {
        appSource: 'isbu-ofis',
        appEntity: getEntityKey('task', input.taskId),
      },
    },
  }
}

function buildHearingEventPayload(
  input: HearingCalendarSyncInput,
  reminderMinutes: number,
  timeZone: string
): CalendarEventPayload {
  const hearingDate = toDate(input.hearingDate)
  const hearingLabel = `Durusma "${input.caseTitle || 'Dava'}"`
  if (!hearingDate) {
    throw new Error(`${hearingLabel} icin tarih bos — takvime eklenemiyor.`)
  }
  ensureValidCalendarDate(hearingDate, input.hearingDate, hearingLabel)

  const descriptionLines = [
    input.caseTitle ? `Dava: ${input.caseTitle}` : null,
    input.caseNumber ? `Esas No: ${input.caseNumber}` : null,
    input.clientName ? `Muvekkil: ${input.clientName}` : null,
    input.judge ? `Hakim: ${input.judge}` : null,
    input.notes ? `Not: ${input.notes}` : null,
    'Bu durusma Isbu Ofis tarafindan otomatik senkronlandi.',
  ].filter(Boolean)

  const location = [input.courtName, input.courtRoom].filter(Boolean).join(' / ')
  const eventEnd = addMinutes(hearingDate, 60)

  let startIso: string
  let endIso: string
  try {
    startIso = hearingDate.toISOString()
    endIso = eventEnd.toISOString()
  } catch {
    throw new Error(`${hearingLabel} icin takvim tarihi ISO formatina cevrilemedi (${input.hearingDate}).`)
  }

  return {
    summary: `Durusma: ${input.caseTitle || 'Dava'}`,
    description: descriptionLines.join('\n'),
    location: location || undefined,
    start: { dateTime: startIso, timeZone },
    end: { dateTime: endIso, timeZone },
    reminders: buildReminderOverrides(resolveReminderMinutes(hearingDate, reminderMinutes)),
    extendedProperties: {
      private: {
        appSource: 'isbu-ofis',
        appEntity: getEntityKey('hearing', input.hearingId),
      },
    },
  }
}

async function findCalendarEventId(entityType: 'task' | 'hearing', entityId: string) {
  const config = getCalendarConfig()
  if (!config) {
    return null
  }

  const params = new URLSearchParams({
    maxResults: '1',
    singleEvents: 'true',
    privateExtendedProperty: `appEntity=${getEntityKey(entityType, entityId)}`,
  })

  const response = await googleCalendarRequest<{ items?: MinimalCalendarEvent[] }>(
    `/calendars/${encodeURIComponent(config.calendarId)}/events?${params.toString()}`
  )

  return response.items?.[0]?.id || null
}

async function upsertCalendarEvent(entityType: 'task' | 'hearing', entityId: string, payload: CalendarEventPayload) {
  const config = getCalendarConfig()
  if (!config) {
    return false
  }

  const existingEventId = await findCalendarEventId(entityType, entityId)

  if (existingEventId) {
    await googleCalendarRequest(
      `/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(existingEventId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    )
    return true
  }

  await googleCalendarRequest(
    `/calendars/${encodeURIComponent(config.calendarId)}/events`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )

  return true
}

async function deleteCalendarEvent(entityType: 'task' | 'hearing', entityId: string) {
  const config = getCalendarConfig()
  if (!config) {
    return false
  }

  const existingEventId = await findCalendarEventId(entityType, entityId)
  if (!existingEventId) {
    return false
  }

  await googleCalendarRequest(
    `/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(existingEventId)}`,
    {
      method: 'DELETE',
    }
  )

  return true
}

export function getCalendarIntegrationStatus() {
  const config = getCalendarConfig()

  return {
    configured: !!config,
    calendarId: config?.calendarId || null,
    calendarLabel: config?.calendarId
      ? config.calendarId.replace(/^(.{3}).+(@.+)$/, '$1***$2')
      : null,
    reminderDays: Math.round((config?.reminderMinutes || DEFAULT_REMINDER_MINUTES) / (24 * 60)),
    timeZone: config?.timeZone || DEFAULT_TIME_ZONE,
    mode: 'service_account',
  }
}

export async function syncTaskToGoogleCalendar(input: TaskCalendarSyncInput) {
  const config = getCalendarConfig()
  if (!config) {
    return { synced: false, reason: 'disabled' as const }
  }

  if (!input.dueDate || input.status === 'completed' || input.status === 'cancelled') {
    await deleteCalendarEvent('task', input.taskId)
    return { synced: false, reason: 'deleted' as const }
  }

  await upsertCalendarEvent(
    'task',
    input.taskId,
    buildTaskEventPayload(input, config.reminderMinutes, config.timeZone)
  )
  return { synced: true, reason: 'synced' as const }
}

export async function syncHearingToGoogleCalendar(input: HearingCalendarSyncInput) {
  const config = getCalendarConfig()
  if (!config) {
    return { synced: false, reason: 'disabled' as const }
  }

  if (!input.hearingDate || input.result === 'completed' || input.result === 'cancelled') {
    await deleteCalendarEvent('hearing', input.hearingId)
    return { synced: false, reason: 'deleted' as const }
  }

  await upsertCalendarEvent(
    'hearing',
    input.hearingId,
    buildHearingEventPayload(input, config.reminderMinutes, config.timeZone)
  )
  return { synced: true, reason: 'synced' as const }
}

export async function deleteTaskFromGoogleCalendar(taskId: string) {
  return deleteCalendarEvent('task', taskId)
}

export async function deleteHearingFromGoogleCalendar(hearingId: string) {
  return deleteCalendarEvent('hearing', hearingId)
}

// Aşamalı teşhis — her adımda ne oldu / ne hata alındı raporla.
// Settings sayfasındaki "Bağlantıyı Test Et" butonu bunu çağırır.
export async function runCalendarDiagnostic() {
  type Step = {
    name: string
    ok: boolean
    detail?: string
    error?: string
  }
  const steps: Step[] = []
  const startedAt = new Date().toISOString()

  // 1) Config kontrolü
  const config = getCalendarConfig()
  if (!config) {
    steps.push({
      name: 'config',
      ok: false,
      error:
        'Ortam değişkenleri eksik: GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
    })
    return { startedAt, ok: false, steps }
  }

  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || ''
  const b64Raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64 || ''
  const keyDiagnostic = {
    sourceMode: b64Raw ? 'B64' : 'PEM',
    hasBegin: /BEGIN PRIVATE KEY/.test(config.privateKey),
    hasEnd: /END PRIVATE KEY/.test(config.privateKey),
    containsLiteralBackslashN: privateKeyRaw.includes('\\n'),
    containsRealNewline: config.privateKey.includes('\n'),
    startsWithQuote: privateKeyRaw.trim().startsWith('"') || privateKeyRaw.trim().startsWith("'"),
    endsWithQuote: privateKeyRaw.trim().endsWith('"') || privateKeyRaw.trim().endsWith("'"),
    hasCRLF: /\r\n/.test(privateKeyRaw),
    rawLength: privateKeyRaw.length,
    b64Length: b64Raw.length,
    normalizedLength: config.privateKey.length,
  }
  steps.push({
    name: 'config',
    ok: true,
    detail:
      `calendarId=${config.calendarId}\n` +
      `sa=${config.clientEmail}\n` +
      `keyMode=${keyDiagnostic.sourceMode}, ` +
      `begin=${keyDiagnostic.hasBegin}, end=${keyDiagnostic.hasEnd}, ` +
      `quotes=${keyDiagnostic.startsWithQuote || keyDiagnostic.endsWithQuote}, ` +
      `crlf=${keyDiagnostic.hasCRLF}, ` +
      `normLen=${keyDiagnostic.normalizedLength}` +
      (b64Raw ? ` (b64Len=${keyDiagnostic.b64Length})` : ` (rawLen=${keyDiagnostic.rawLength})`),
  })

  // 2) Key parse testi — createPrivateKey ile
  try {
    const keyObj = createPrivateKey(config.privateKey)
    steps.push({
      name: 'key_parse',
      ok: true,
      detail: `Private key OK — type=${keyObj.asymmetricKeyType}, format=${keyObj.type}`,
    })
  } catch (err) {
    steps.push({
      name: 'key_parse',
      ok: false,
      error:
        (err instanceof Error ? err.message : String(err)) +
        '\nÇözüm adımları:\n' +
        '1. JSON key dosyasındaki "private_key" değerini kopyalarken BAŞTAKI/SONDAKI ÇİFT TIRNAK (") dahil etme.\n' +
        '2. Render > Environment > GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY alanını sil ve tekrar yapıştır.\n' +
        '3. Alternatif: Local\'de `node -e "console.log(Buffer.from(require(\'fs\').readFileSync(\'key.pem\')).toString(\'base64\'))"` ile base64\'e çevir, Render\'a GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64 olarak yapıştır.',
    })
    return { startedAt, ok: false, steps }
  }

  // 3) Access token
  let accessToken: string | null = null
  try {
    accessToken = await getGoogleAccessToken()
    if (!accessToken) {
      steps.push({ name: 'token', ok: false, error: 'Access token null döndü' })
      return { startedAt, ok: false, steps }
    }
    steps.push({
      name: 'token',
      ok: true,
      detail: `Access token alındı (${accessToken.slice(0, 12)}... uzunluk=${accessToken.length})`,
    })
  } catch (err) {
    steps.push({ name: 'token', ok: false, error: err instanceof Error ? err.message : String(err) })
    return { startedAt, ok: false, steps }
  }

  // 4) Calendar erişimi (GET metadata)
  try {
    const calResp = await fetch(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(config.calendarId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!calResp.ok) {
      const body = await calResp.text()
      steps.push({
        name: 'calendar_access',
        ok: false,
        error: `${calResp.status} ${calResp.statusText}: ${body}`,
      })
      return { startedAt, ok: false, steps }
    }
    const cal = (await calResp.json()) as { summary?: string; timeZone?: string }
    steps.push({
      name: 'calendar_access',
      ok: true,
      detail: `Takvim okundu: "${cal.summary}" (${cal.timeZone})`,
    })
  } catch (err) {
    steps.push({
      name: 'calendar_access',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
    return { startedAt, ok: false, steps }
  }

  // 5) Test event oluştur
  const testPayload: CalendarEventPayload = {
    summary: 'Isbu Ofis - Bağlantı testi',
    description: 'Bu olay teşhis amaçlıdır ve hemen silinecektir.',
    start: { dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), timeZone: config.timeZone },
    end: { dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(), timeZone: config.timeZone },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] },
    extendedProperties: {
      private: {
        appSource: 'isbu-ofis',
        appEntity: `diagnostic:${Date.now()}`,
      },
    },
  }

  let testEventId: string | null = null
  try {
    const createResp = await fetch(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(config.calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      }
    )
    if (!createResp.ok) {
      const body = await createResp.text()
      steps.push({
        name: 'event_create',
        ok: false,
        error: `${createResp.status} ${createResp.statusText}: ${body}`,
      })
      return { startedAt, ok: false, steps }
    }
    const created = (await createResp.json()) as { id?: string; htmlLink?: string }
    testEventId = created.id || null
    steps.push({
      name: 'event_create',
      ok: true,
      detail: `Test etkinliği oluşturuldu: id=${testEventId}`,
    })
  } catch (err) {
    steps.push({
      name: 'event_create',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
    return { startedAt, ok: false, steps }
  }

  // 6) Test event sil (temizlik)
  if (testEventId) {
    try {
      const delResp = await fetch(
        `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(testEventId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      if (!delResp.ok && delResp.status !== 410) {
        const body = await delResp.text()
        steps.push({
          name: 'event_delete',
          ok: false,
          error: `${delResp.status}: ${body}`,
        })
      } else {
        steps.push({ name: 'event_delete', ok: true, detail: 'Test etkinliği silindi' })
      }
    } catch (err) {
      steps.push({
        name: 'event_delete',
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const allOk = steps.every((s) => s.ok)
  return { startedAt, ok: allOk, steps }
}
