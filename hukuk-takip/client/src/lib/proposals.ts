// Asistan önerileri — saf yardımcılar (etiketler, önce→sonra farkı, düzenleme alanları).
//
// Öneri payload'ı snake_case (asistan sözleşmesi), "before" ise hedef satırın
// camelCase anlık görüntüsüdür (sunucu: proposalTargets.ts). Burada ikisini
// aynı alan tanımı üzerinden eşleyip avukatın okuyacağı Türkçe satırlara çeviririz.
import type { ProposalKind } from '@hukuk-takip/shared'

export type ProposalStatusFilter = 'pending' | 'applied' | 'rejected' | 'failed'

export interface ProposalRow {
  id: string
  kind: ProposalKind | string
  status: string
  caseId: string | null
  caseTitle: string | null
  caseNumber: string | null
  caseRef: Record<string, unknown> | null
  targetType: string | null
  targetId: string | null
  externalRef: string
  payload: Record<string, unknown>
  before: Record<string, unknown> | null
  conflict: boolean
  summary: string
  reason: string | null
  source: string
  decidedNote: string | null
  error: string | null
  createdAt: string
  updatedAt: string
  decidedAt: string | null
}

export const PROPOSAL_STATUS_TABS: Array<{ value: ProposalStatusFilter; label: string }> = [
  { value: 'pending', label: 'Bekleyen' },
  { value: 'applied', label: 'Uygulanan' },
  { value: 'rejected', label: 'Reddedilen' },
  { value: 'failed', label: 'Hatalı' },
]

// Gruplama sırası: avukatın en çok baktığı kayıtlar üstte.
export const PROPOSAL_KIND_ORDER: string[] = [
  'case_upsert',
  'hearing_upsert',
  'deadline_upsert',
  'diary_add',
  'enforcement_upsert',
  'task_add',
  'next_step',
  'status_change',
]

export const PROPOSAL_KIND_GROUP_LABELS: Record<string, string> = {
  case_upsert: 'Dava',
  hearing_upsert: 'Duruşma',
  deadline_upsert: 'Süre',
  diary_add: 'Günlük',
  enforcement_upsert: 'İcra',
  task_add: 'İş',
  next_step: 'Sıradaki adım',
  status_change: 'Durum',
}

export const PROPOSAL_SOURCE_LABELS: Record<string, string> = {
  uyap: 'UYAP',
  kalkan: 'Süre Kalkanı',
  icra_ozet: 'İcra',
  asistan: 'Asistan',
}

export function proposalKindLabel(kind: string): string {
  return PROPOSAL_KIND_GROUP_LABELS[kind] ?? kind
}

export function proposalSourceLabel(source: string): string {
  return PROPOSAL_SOURCE_LABELS[source] ?? source
}

type FieldFormat =
  | 'text'
  | 'date'
  | 'datetime'
  | 'money'
  | 'bool'
  | 'caseStatus'
  | 'caseType'
  | 'priority'
  | 'hearingResult'
  | 'severity'
  | 'taskStatus'
  | 'list'

interface FieldDef {
  key: string // payload anahtarı (snake_case)
  label: string
  before?: string // before anahtarı (camelCase); yoksa karşılaştırılmaz
  format?: FieldFormat
}

const CASE_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Dava adı', before: 'title' },
  { key: 'client_name', label: 'Müvekkil' },
  { key: 'case_number', label: 'Esas no', before: 'caseNumber' },
  { key: 'court_name', label: 'Mahkeme', before: 'courtName' },
  { key: 'case_type', label: 'Dava türü', before: 'caseType', format: 'caseType' },
  { key: 'custom_case_type', label: 'Özel tür', before: 'customCaseType' },
  { key: 'start_date', label: 'Başlangıç', before: 'startDate', format: 'date' },
  { key: 'buro_kodu', label: 'Büro kodu', before: 'buroKodu' },
  { key: 'contracted_fee', label: 'Anlaşılan ücret', before: 'contractedFee', format: 'money' },
  { key: 'is_cmk_assignment', label: 'CMK görevlendirmesi', before: 'isCmkAssignment', format: 'bool' },
  { key: 'status', label: 'Durum', before: 'status', format: 'caseStatus' },
  { key: 'description', label: 'Açıklama', before: 'description' },
]

const FIELDS: Record<string, FieldDef[]> = {
  case_upsert: CASE_FIELDS,
  hearing_upsert: [
    { key: 'hearing_date', label: 'Duruşma tarihi', before: 'hearingDate', format: 'datetime' },
    { key: 'court_room', label: 'Salon', before: 'courtRoom' },
    { key: 'judge', label: 'Hakim', before: 'judge' },
    { key: 'result', label: 'Sonuç', before: 'result', format: 'hearingResult' },
    { key: 'notes', label: 'Not', before: 'notes' },
  ],
  deadline_upsert: [
    { key: 'title', label: 'Başlık', before: 'title' },
    { key: 'due_date', label: 'Son gün', before: 'dueDate', format: 'date' },
    { key: 'condition', label: 'Koşul' },
    { key: 'priority', label: 'Öncelik', before: 'priority', format: 'priority' },
    { key: 'legal_basis', label: 'Dayanak', before: 'legalBasis' },
    { key: 'deadline_severity', label: 'Süre niteliği', before: 'deadlineSeverity', format: 'severity' },
    { key: 'trigger_event_label', label: 'Tetikleyen olay', before: 'triggerEventLabel' },
    { key: 'trigger_event_date', label: 'Olay tarihi', before: 'triggerEventDate', format: 'date' },
    { key: 'status', label: 'Durum', before: 'status', format: 'taskStatus' },
    { key: 'description', label: 'Açıklama', before: 'description' },
  ],
  task_add: [
    { key: 'title', label: 'Başlık', before: 'title' },
    { key: 'due_date', label: 'Son gün', before: 'dueDate', format: 'date' },
    { key: 'priority', label: 'Öncelik', before: 'priority', format: 'priority' },
    { key: 'description', label: 'Açıklama', before: 'description' },
  ],
  diary_add: [
    { key: 'title', label: 'Başlık', before: 'title' },
    { key: 'content', label: 'İçerik', before: 'content' },
    { key: 'occurred_at', label: 'Tarih', before: 'occurredAt', format: 'datetime' },
    { key: 'next_step', label: 'Sonraki adım', before: 'nextStep' },
    { key: 'next_step_due_date', label: 'Sonraki adım tarihi', before: 'nextStepDueDate', format: 'date' },
  ],
  next_step: [
    { key: 'stage', label: 'Aşama', before: 'stage' },
    { key: 'waiting_for', label: 'Beklenen', before: 'waitingFor' },
    { key: 'check_date', label: 'Kontrol tarihi', before: 'checkDate', format: 'date' },
    { key: 'next_step', label: 'Sonraki adım', before: 'nextStep' },
    { key: 'next_step_due_date', label: 'Sonraki adım tarihi', before: 'nextStepDueDate', format: 'date' },
  ],
  status_change: [
    { key: 'status', label: 'Durum', before: 'status', format: 'caseStatus' },
    { key: 'close_date', label: 'Kapanış tarihi', before: 'closeDate', format: 'date' },
    { key: 'note', label: 'Not' },
  ],
}

export const ENFORCEMENT_LABELS: Record<string, string> = {
  alacakli: 'Alacaklı',
  borclu: 'Borçlu',
  rolumuz: 'Rolümüz',
  alacak: 'Alacak',
  tahsilat: 'Tahsilat',
  odeme_emri: 'Ödeme emri',
  itiraz: 'İtiraz',
  kesinlesme: 'Kesinleşme',
  son_islem: 'Son işlem',
  tasinmaz: 'Taşınmaz',
  arac: 'Araç',
  banka: 'Banka',
  sgk: 'SGK',
  fiili: 'Fiili haciz',
  sorgu_onerisi: 'Sorgu önerisi',
  not: 'Not',
}

const CASE_STATUS: Record<string, string> = {
  active: 'Aktif', istinafta: 'İstinafta', yargitayda: 'Yargıtayda', passive: 'Potansiyel',
  closed: 'Kapatıldı', won: 'Kazanıldı', lost: 'Kaybedildi', settled: 'Uzlaşıldı',
}
const CASE_TYPE: Record<string, string> = {
  iscilik_alacagi: 'İşçilik alacağı', bosanma: 'Boşanma', velayet: 'Velayet', mal_paylasimi: 'Mal paylaşımı',
  kira: 'Kira', tuketici: 'Tüketici', icra: 'İcra', ceza: 'Ceza', idare: 'İdare', diger: 'Diğer',
}
const PRIORITY: Record<string, string> = { low: 'Düşük', medium: 'Orta', high: 'Yüksek', urgent: 'Acil' }
const HEARING_RESULT: Record<string, string> = {
  pending: 'Beklemede', completed: 'Tamamlandı', postponed: 'Ertelendi', cancelled: 'İptal edildi',
}
const SEVERITY: Record<string, string> = { hak_dusurucu: 'Hak düşürücü', zamanasimi: 'Zamanaşımı', usul: 'Usul' }
const TASK_STATUS: Record<string, string> = {
  pending: 'Beklemede', in_progress: 'Devam ediyor', completed: 'Tamamlandı', cancelled: 'İptal edildi',
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function istanbulParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { day: get('day'), month: get('month'), year: get('year'), hour: get('hour'), minute: get('minute') }
}

// Gün (YYYY-AA-GG) olduğu gibi okunur; zaman damgası İstanbul saatine çevrilir
// (cihaz saat diliminden bağımsız — avukat yurtdışında da aynı günü görür).
export function formatProposalDate(value: unknown, withTime = false): string | null {
  if (value == null || value === '') return null
  const text = String(value)
  const day = DAY_RE.exec(text)
  if (day) return `${day[3]}.${day[2]}.${day[1]}`
  const date = new Date(text)
  if (!Number.isFinite(date.getTime())) return text
  const p = istanbulParts(date)
  const base = `${p.day}.${p.month}.${p.year}`
  return withTime ? `${base} ${p.hour}:${p.minute}` : base
}

function formatMoney(value: unknown): string {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(n)) return String(value)
  return `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} TL`
}

export function formatProposalValue(value: unknown, format: FieldFormat = 'text'): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  switch (format) {
    case 'date':
      return formatProposalDate(value, false)
    case 'datetime':
      return formatProposalDate(value, true)
    case 'money':
      return formatMoney(value)
    case 'bool':
      return value === true || value === 'true' ? 'Evet' : 'Hayır'
    case 'caseStatus':
      return CASE_STATUS[String(value)] ?? String(value)
    case 'caseType':
      return CASE_TYPE[String(value)] ?? String(value)
    case 'priority':
      return PRIORITY[String(value)] ?? String(value)
    case 'hearingResult':
      return HEARING_RESULT[String(value)] ?? String(value)
    case 'severity':
      return SEVERITY[String(value)] ?? String(value)
    case 'taskStatus':
      return TASK_STATUS[String(value)] ?? String(value)
    default:
      if (Array.isArray(value)) return value.map((v) => formatProposalValue(v) ?? '—').join(', ')
      if (typeof value === 'object') return JSON.stringify(value)
      if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır'
      return String(value)
  }
}

export type DiffEffect = 'new' | 'change' | 'same' | 'kept'

export interface ProposalDiffRow {
  key: string
  label: string
  before: string | null
  after: string | null
  effect: DiffEffect
}

// Öneri → okunur satırlar. Yalnızca payload'da gelen alanlar listelenir.
//   new    : hedefte değer yok, öneri dolduracak
//   change : dolu değer değişecek (çakışma adayı)
//   same   : değer zaten aynı
//   kept   : dava önerisinde dolu alan, overwrite istenmediği için KORUNACAK
export function buildProposalDiff(
  kind: string,
  payload: Record<string, unknown> | null | undefined,
  before: Record<string, unknown> | null | undefined
): ProposalDiffRow[] {
  const data = payload ?? {}
  const snap = before ?? null
  if (kind === 'enforcement_upsert') {
    const fields = (data.data && typeof data.data === 'object' ? data.data : {}) as Record<string, unknown>
    return Object.keys(fields).map((key) =>
      diffRow({ key, label: ENFORCEMENT_LABELS[key] ?? key, before: key }, fields[key], snap, null)
    )
  }
  const defs = FIELDS[kind] ?? []
  const overwrite = kind === 'case_upsert' && Array.isArray(data.overwrite) ? (data.overwrite as string[]) : null
  return defs
    .filter((def) => data[def.key] !== undefined)
    .map((def) => diffRow(def, data[def.key], snap, kind === 'case_upsert' ? overwrite ?? [] : null))
}

function diffRow(
  def: FieldDef,
  rawAfter: unknown,
  snap: Record<string, unknown> | null,
  overwrite: string[] | null
): ProposalDiffRow {
  const after = formatProposalValue(rawAfter, def.format)
  const before = snap && def.before ? formatProposalValue(snap[def.before], def.format) : null
  let effect: DiffEffect
  if (!snap || !def.before || before === null) effect = 'new'
  else if (before === after) effect = 'same'
  else if (overwrite && !overwrite.includes(def.key) && def.key !== 'status') effect = 'kept'
  else effect = 'change'
  return { key: def.key, label: def.label, before, after, effect }
}

// ─── Düzenle ve onayla ─────────────────────────────────────────────────────

export type EditInput = 'text' | 'textarea' | 'date' | 'datetime' | 'select'

export interface EditFieldDef {
  key: string
  label: string
  input: EditInput
  options?: Array<{ value: string; label: string }>
  required?: boolean
}

const STATUS_OPTIONS = Object.entries(CASE_STATUS).map(([value, label]) => ({ value, label }))

const EDIT_FIELDS: Record<string, EditFieldDef[]> = {
  case_upsert: [
    { key: 'title', label: 'Dava adı', input: 'text' },
    { key: 'case_number', label: 'Esas no', input: 'text' },
    { key: 'court_name', label: 'Mahkeme', input: 'text' },
    { key: 'start_date', label: 'Başlangıç', input: 'date' },
    { key: 'description', label: 'Açıklama', input: 'textarea' },
  ],
  hearing_upsert: [
    { key: 'hearing_date', label: 'Duruşma tarihi ve saati', input: 'datetime', required: true },
    { key: 'court_room', label: 'Salon', input: 'text' },
    { key: 'judge', label: 'Hakim', input: 'text' },
    { key: 'notes', label: 'Not', input: 'textarea' },
  ],
  deadline_upsert: [
    { key: 'title', label: 'Başlık', input: 'text', required: true },
    { key: 'due_date', label: 'Son gün', input: 'date' },
    { key: 'legal_basis', label: 'Dayanak', input: 'text' },
    { key: 'description', label: 'Açıklama', input: 'textarea' },
  ],
  task_add: [
    { key: 'title', label: 'Başlık', input: 'text', required: true },
    { key: 'due_date', label: 'Son gün', input: 'date' },
    { key: 'description', label: 'Açıklama', input: 'textarea' },
  ],
  diary_add: [
    { key: 'title', label: 'Başlık', input: 'text' },
    { key: 'content', label: 'İçerik', input: 'textarea', required: true },
    { key: 'next_step', label: 'Sonraki adım', input: 'text' },
    { key: 'next_step_due_date', label: 'Sonraki adım tarihi', input: 'date' },
  ],
  status_change: [
    { key: 'status', label: 'Durum', input: 'select', options: STATUS_OPTIONS, required: true },
    { key: 'close_date', label: 'Kapanış tarihi', input: 'date' },
    { key: 'note', label: 'Not', input: 'textarea' },
  ],
}

export function editFieldsFor(kind: string, payload: Record<string, unknown>): EditFieldDef[] {
  if (kind === 'next_step') {
    return payload.target === 'diary'
      ? [
          { key: 'next_step', label: 'Sonraki adım', input: 'text', required: true },
          { key: 'next_step_due_date', label: 'Sonraki adım tarihi', input: 'date' },
        ]
      : [
          { key: 'stage', label: 'Aşama', input: 'text' },
          { key: 'waiting_for', label: 'Beklenen', input: 'text' },
          { key: 'check_date', label: 'Kontrol tarihi', input: 'date' },
        ]
  }
  return EDIT_FIELDS[kind] ?? []
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Payload değerini form alanına çevirir. Gün alanına ISO gelirse İstanbul günü alınır.
export function toEditValue(value: unknown, input: EditInput): string {
  if (value === undefined || value === null) return ''
  const text = String(value)
  if (input === 'date') {
    if (DAY_RE.test(text)) return text
    const date = new Date(text)
    if (!Number.isFinite(date.getTime())) return ''
    const p = istanbulParts(date)
    return `${p.year}-${p.month}-${p.day}`
  }
  if (input === 'datetime') {
    const date = new Date(text)
    if (!Number.isFinite(date.getTime())) return ''
    // datetime-local cihaz saatinde çalışır
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  return text
}

// Formdaki değerleri orijinal payload'ın üzerine uygular (yeni obje döner).
// Boş bırakılan isteğe bağlı alan payload'dan çıkarılır; doğrulama sunucudadır (422).
export function applyEdits(
  kind: string,
  payload: Record<string, unknown>,
  values: Record<string, string>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...payload }
  for (const field of editFieldsFor(kind, payload)) {
    if (!(field.key in values)) continue
    const raw = values[field.key].trim()
    if (raw === '') {
      delete next[field.key]
      continue
    }
    if (field.input === 'datetime') {
      const date = new Date(raw)
      next[field.key] = Number.isFinite(date.getTime()) ? date.toISOString() : raw
    } else {
      next[field.key] = raw
    }
  }
  if (kind === 'deadline_upsert' && typeof next.due_date === 'string' && next.due_date) {
    // Tarih girildiyse süre artık koşullu değildir.
    delete next.conditional
    delete next.condition
  }
  return next
}

export function groupProposals<T extends { kind: string }>(rows: T[]): Array<{ kind: string; label: string; items: T[] }> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const list = map.get(row.kind) ?? []
    list.push(row)
    map.set(row.kind, list)
  }
  const rank = (kind: string) => {
    const i = PROPOSAL_KIND_ORDER.indexOf(kind)
    return i === -1 ? PROPOSAL_KIND_ORDER.length : i
  }
  return [...map.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([kind, items]) => ({ kind, label: proposalKindLabel(kind), items }))
}

// Sunucu hatasını kullanıcıya gösterilecek tek satıra indirger (409/422 dahil).
export function proposalErrorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: { error?: string; details?: unknown } } })?.response
  const data = response?.data
  const base = typeof data?.error === 'string' && data.error ? data.error : null
  const details = Array.isArray(data?.details)
    ? (data!.details as Array<{ path?: string; message?: string }>)
        .map((d) => (d?.path ? `${d.path}: ${d.message}` : d?.message))
        .filter(Boolean)
        .slice(0, 3)
        .join('; ')
    : ''
  if (base && details) return `${base} (${details})`
  if (base) return base
  if (error instanceof Error && error.message && !response) return error.message
  return fallback
}

// ─── Eşzamanlılık sözleşmesi (expected_updated_at) ──────────────────────────
// Onay/toplu istekleri önerinin listede görülen updatedAt'ini taşır. Sunucu:
//   409 code=PROPOSAL_CHANGED → öneri o arada değişti; liste yenilenir, yeniden incelenir
//   409 code=TARGET_CHANGED   → hedef kayıt öneriden sonra avukatça düzenlendi;
//                                avukat açıkça "Yine de üzerine yaz" derse force_overwrite=true
// Toplu işlemde hiçbir zaman force gönderilmez; atlananlar listelenir.

export type ProposalConflictCode = 'PROPOSAL_CHANGED' | 'TARGET_CHANGED'

export function proposalErrorCode(error: unknown): ProposalConflictCode | null {
  const response = (error as { response?: { status?: number; data?: { code?: unknown } } })?.response
  const code = response?.data?.code
  return code === 'PROPOSAL_CHANGED' || code === 'TARGET_CHANGED' ? code : null
}

export function buildApproveBody(
  proposal: Pick<ProposalRow, 'updatedAt'>,
  options: { payload?: Record<string, unknown>; note?: string; forceOverwrite?: boolean } = {}
): Record<string, unknown> {
  const body: Record<string, unknown> = { expected_updated_at: proposal.updatedAt }
  if (options.payload) body.payload = options.payload
  const note = options.note?.trim()
  if (note) body.note = note
  if (options.forceOverwrite) body.force_overwrite = true
  return body
}

export function buildBulkBody(
  proposals: Array<Pick<ProposalRow, 'id' | 'updatedAt'>>,
  action: 'approve' | 'reject',
  note?: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    ids: proposals.map((p) => p.id),
    action,
    expected_updated_at: Object.fromEntries(proposals.map((p) => [p.id, p.updatedAt])),
  }
  const trimmed = note?.trim()
  if (trimmed) body.note = trimmed
  return body
}

export interface BulkResultRow {
  id: string
  status: string
  error?: string
  code?: string
}

const BULK_CODE_LABELS: Record<string, string> = {
  PROPOSAL_CHANGED: 'öneri güncellendi, yeniden inceleyin',
  TARGET_CHANGED: 'kaydı siz düzenlemiştiniz, tek tek inceleyin',
}

// Toplu sonucu özetler: kaç tanesi uygulandı/reddedildi, hangileri atlandı ve neden.
export function summarizeBulkResults(results: BulkResultRow[]) {
  const done = results.filter((r) => r.status === 'applied' || r.status === 'rejected').length
  const skipped = results
    .filter((r) => r.status !== 'applied' && r.status !== 'rejected')
    .map((r) => ({
      id: r.id,
      reason: (r.code && BULK_CODE_LABELS[r.code]) || r.error || (r.status === 'failed' ? 'uygulanamadı' : 'atlandı'),
    }))
  return { done, skipped }
}
